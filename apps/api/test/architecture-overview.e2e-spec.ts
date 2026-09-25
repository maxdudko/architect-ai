import { INestApplication } from '@nestjs/common';
import {
  ArchitectureOverviewGenerationStatus,
  ArchitectureOverviewGenerationTrigger,
  CodeSymbolType,
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
  IndexingRunStatus,
  IndexingTrigger,
  RepositoryStatus,
  SymbolRelationType,
  UsageMetric,
  WorkspaceRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { SystemOverviewOrchestrator } from '../src/modules/architecture/system-overview/system-overview.orchestrator';
import { SYSTEM_OVERVIEW_HEADINGS } from '../src/modules/architecture/system-overview/system-overview.constants';
import type { LlmProvider } from '../src/modules/llm/interfaces/llm-provider.interface';
import { RetrievalService } from '../src/modules/retrieval/retrieval.service';
import type { RetrievedContext } from '../src/modules/retrieval/types/retrieved-context.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkspaceLlmResolver } from '../src/workspace-ai/workspace-llm.resolver';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';
import {
  authHeader,
  connectRepository,
  signUp,
  uniqueEmail,
} from './helpers/factories';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

const emptyRetrieval: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

function overviewMarkdown(path: string): string {
  return [
    '# Draft',
    ...SYSTEM_OVERVIEW_HEADINGS.flatMap((heading) => [
      `## ${heading}`,
      heading === 'Main Modules'
        ? `Billing lives in \`${path}\`.`
        : 'Observed from the indexed dependency map.',
    ]),
  ].join('\n\n');
}

describeE2e('System overview (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let llmCalls: number;
  let generatedMarkdown: string;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    const context = await createE2eApp();
    app = context.app;
    prisma = context.prisma;
    await resetDatabase(prisma);
    llmCalls = 0;
    generatedMarkdown = overviewMarkdown('src/billing/invoice.ts');

    const provider: LlmProvider = {
      name: 'scripted',
      generate: () => {
        llmCalls += 1;
        return Promise.resolve({
          content: generatedMarkdown,
          model: 'scripted',
        });
      },
      stream() {
        const events = [
          { type: 'token' as const, text: generatedMarkdown },
          {
            type: 'done' as const,
            content: generatedMarkdown,
            model: 'scripted',
          },
        ];
        return {
          [Symbol.asyncIterator]() {
            let index = 0;
            return {
              next: () => {
                const value = events[index];
                index += 1;
                return Promise.resolve(
                  value
                    ? { done: false as const, value }
                    : { done: true as const, value: undefined },
                );
              },
            };
          },
        };
      },
    };
    jest
      .spyOn(app.get(WorkspaceLlmResolver), 'resolve')
      .mockResolvedValue(provider);
    jest
      .spyOn(app.get(RetrievalService), 'retrieve')
      .mockResolvedValue(emptyRetrieval);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  async function readyRepository() {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const runId = await seedRevision(prisma, repository.id, {
      files: [
        'src/billing/invoice.ts',
        'src/billing/tax.ts',
        'src/features/checkout.ts',
        'src/features/auth.ts',
      ],
      imports: [
        {
          from: 'src/features/checkout.ts',
          targetFilePath: '../billing/invoice',
          targetQualifiedName: 'invoice',
        },
      ],
      commitSha: 'current-sha',
      completedAt: new Date('2026-09-02T00:00:00.000Z'),
    });
    return { auth, repository, runId };
  }

  function overviewPath(workspaceId: string, repositoryId: string): string {
    return `/workspaces/${workspaceId}/repositories/${repositoryId}/architecture/overview`;
  }

  it('accepts generation without calling the model, then stores a valid overview', async () => {
    const { auth, repository, runId } = await readyRepository();
    const path = overviewPath(auth.activeWorkspace.id, repository.id);

    const queued = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(202);

    expect(queued.body.status).toBe(
      ArchitectureOverviewGenerationStatus.QUEUED,
    );
    expect(llmCalls).toBe(0);
    expect(await prisma.architectureOverview.count()).toBe(0);

    const again = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(202);
    expect(again.body.id).toBe(queued.body.id);

    await app.get(SystemOverviewOrchestrator).execute(queued.body.id);

    const { body } = await request(app.getHttpServer())
      .get(path)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.overview.revision.indexingRunId).toBe(runId);
    expect(body.overview.stale).toBe(false);
    expect(body.overview.markdown).toContain('## Main Modules');
    expect(body.overview.markdown).toContain('src/billing/invoice.ts');
    expect(body.overview.modulesAbsent).toBe(false);
    expect(body.run.status).toBe(
      ArchitectureOverviewGenerationStatus.SUCCEEDED,
    );
    expect(llmCalls).toBe(1);
  });

  it('keeps the previous overview when regeneration cites a missing path', async () => {
    const { auth, repository } = await readyRepository();
    const path = overviewPath(auth.activeWorkspace.id, repository.id);
    const first = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(202);
    await app.get(SystemOverviewOrchestrator).execute(first.body.id);

    generatedMarkdown = overviewMarkdown('missing/not-indexed.ts');
    const second = await request(app.getHttpServer())
      .post(`${path}/generations/regenerate`)
      .set(authHeader(auth.accessToken))
      .expect(202);
    await expect(
      app.get(SystemOverviewOrchestrator).execute(second.body.id),
    ).rejects.toThrow(/cited paths/i);

    const { body } = await request(app.getHttpServer())
      .get(path)
      .set(authHeader(auth.accessToken))
      .expect(200);
    expect(body.overview.markdown).toContain('src/billing/invoice.ts');
    expect(body.overview.markdown).not.toContain('missing/not-indexed.ts');
    expect(body.run.status).toBe(ArchitectureOverviewGenerationStatus.FAILED);
    expect(body.run.error).toContain('not in this indexing revision');
  });

  it('refuses generation when indexing has never succeeded and writes no run', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const path = overviewPath(auth.activeWorkspace.id, repository.id);

    const { body } = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(409);

    expect(JSON.stringify(body)).toContain('indexing');
    expect(await prisma.architectureOverviewGenerationRun.count()).toBe(0);
    expect(llmCalls).toBe(0);

    const read = await request(app.getHttpServer())
      .get(path)
      .set(authHeader(auth.accessToken))
      .expect(200);
    expect(read.body.overview).toBeNull();
    expect(read.body.generationAllowed).toBe(false);
  });

  it('rejects another workspace without exposing module names', async () => {
    const { repository } = await readyRepository();
    const outsider = await signUp(app, {
      email: uniqueEmail('outsider'),
      password: 'Password123!',
      firstName: 'Out',
      lastName: 'Sider',
    });

    const { body } = await request(app.getHttpServer())
      .get(overviewPath(outsider.activeWorkspace.id, repository.id))
      .set(authHeader(outsider.accessToken))
      .expect(404);

    expect(JSON.stringify(body)).not.toContain('src/billing');
  });

  it('refuses when the generation allowance is exhausted and writes no run', async () => {
    const { auth, repository } = await readyRepository();
    const passwordHash = await bcrypt.hash('AdminPassword123!', 12);
    await prisma.admin.create({
      data: {
        email: 'admin@architect.ai',
        passwordHash,
        firstName: 'Platform',
        lastName: 'Admin',
      },
    });
    const { body: admin } = await request(app.getHttpServer())
      .post('/admin/auth/signin')
      .send({ email: 'admin@architect.ai', password: 'AdminPassword123!' })
      .expect(201);
    const freePlan = await prisma.plan.findUniqueOrThrow({
      where: { key: 'free' },
    });
    await request(app.getHttpServer())
      .patch(`/admin/plans/${freePlan.id}/limits`)
      .set(authHeader(admin.accessToken))
      .send({
        limits: [{ metric: UsageMetric.GUIDE_GENERATIONS, maxValue: 0 }],
      })
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .post(
        overviewPath(auth.activeWorkspace.id, repository.id) + '/generations',
      )
      .set(authHeader(auth.accessToken))
      .expect(403);

    expect(body.error).toEqual(
      expect.objectContaining({
        code: 'USAGE_LIMIT_EXCEEDED',
        metric: UsageMetric.GUIDE_GENERATIONS,
      }),
    );
    expect(await prisma.architectureOverviewGenerationRun.count()).toBe(0);
  });

  it('lets a viewer read an overview and refuses generation', async () => {
    const { auth, repository } = await readyRepository();
    const path = overviewPath(auth.activeWorkspace.id, repository.id);
    const queued = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(202);
    await app.get(SystemOverviewOrchestrator).execute(queued.body.id);

    await prisma.membership.updateMany({
      where: { workspaceId: auth.activeWorkspace.id, userId: auth.user.id },
      data: { role: WorkspaceRole.VIEWER },
    });

    const { body } = await request(app.getHttpServer())
      .get(path)
      .set(authHeader(auth.accessToken))
      .expect(200);
    expect(body.overview.markdown).toContain('src/billing/invoice.ts');

    await request(app.getHttpServer())
      .post(`${path}/generations/regenerate`)
      .set(authHeader(auth.accessToken))
      .expect(403);
  });

  it('labels an overview stale after a newer indexing revision succeeds', async () => {
    const { auth, repository } = await readyRepository();
    const path = overviewPath(auth.activeWorkspace.id, repository.id);
    const queued = await request(app.getHttpServer())
      .post(`${path}/generations`)
      .set(authHeader(auth.accessToken))
      .expect(202);
    await app.get(SystemOverviewOrchestrator).execute(queued.body.id);

    await seedRevision(prisma, repository.id, {
      files: ['src/billing/invoice.ts', 'src/billing/tax.ts'],
      commitSha: 'newer-sha',
      completedAt: new Date('2026-09-03T00:00:00.000Z'),
    });

    const { body } = await request(app.getHttpServer())
      .get(path)
      .set(authHeader(auth.accessToken))
      .expect(200);
    expect(body.overview.stale).toBe(true);
    expect(body.overview.revision.commitSha).toBe('current-sha');
    expect(body.latestRevision.commitSha).toBe('newer-sha');
  });

  it('still queues an overview while a guide generation run is active', async () => {
    const { auth, repository } = await readyRepository();
    await prisma.guideGenerationRun.create({
      data: {
        workspaceId: auth.activeWorkspace.id,
        repositoryId: repository.id,
        trigger: GuideGenerationTrigger.MANUAL_GENERATE,
        status: GuideGenerationStatus.RUNNING,
        requestedTypes: [GuideType.PROJECT_OVERVIEW],
      },
    });

    const { body } = await request(app.getHttpServer())
      .post(
        `${overviewPath(auth.activeWorkspace.id, repository.id)}/generations`,
      )
      .set(authHeader(auth.accessToken))
      .expect(202);

    expect(body.trigger).toBe(
      ArchitectureOverviewGenerationTrigger.MANUAL_GENERATE,
    );
    expect(body.status).toBe(ArchitectureOverviewGenerationStatus.QUEUED);
  });
});

async function seedRevision(
  prisma: PrismaService,
  repositoryId: string,
  options: {
    files: string[];
    imports?: Array<{
      from: string;
      targetFilePath: string;
      targetQualifiedName: string;
    }>;
    commitSha: string;
    completedAt: Date;
  },
): Promise<string> {
  const run = await prisma.indexingRun.create({
    data: {
      repositoryId,
      trigger: IndexingTrigger.INITIAL_CONNECT,
      status: IndexingRunStatus.SUCCEEDED,
      branch: 'main',
      commitSha: options.commitSha,
      completedAt: options.completedAt,
    },
  });

  for (const path of options.files) {
    await prisma.repositoryFile.create({
      data: {
        repositoryId,
        indexingRunId: run.id,
        path,
        language: 'typescript',
        contentHash: `hash-${path}-${run.id}`,
        size: 100,
        lineCount: 20,
        extension: '.ts',
      },
    });
    await prisma.codeSymbol.create({
      data: {
        repositoryId,
        indexingRunId: run.id,
        filePath: path,
        type: CodeSymbolType.MODULE,
        name: path,
        qualifiedName: path,
        language: 'typescript',
        startLine: 1,
        endLine: 20,
        startColumn: 0,
        endColumn: 0,
      },
    });
  }

  const symbols = await prisma.codeSymbol.findMany({
    where: { indexingRunId: run.id, type: CodeSymbolType.MODULE },
  });
  const symbolIdByPath = new Map(
    symbols.map((symbol) => [symbol.filePath, symbol.id]),
  );

  for (const relation of options.imports ?? []) {
    const fromSymbolId = symbolIdByPath.get(relation.from);
    if (!fromSymbolId) {
      throw new Error(`Missing module symbol for ${relation.from}`);
    }
    await prisma.symbolRelation.create({
      data: {
        repositoryId,
        indexingRunId: run.id,
        fromSymbolId,
        relationType: SymbolRelationType.IMPORTS,
        targetFilePath: relation.targetFilePath,
        targetQualifiedName: relation.targetQualifiedName,
      },
    });
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      status: RepositoryStatus.READY,
      lastIndexedAt: options.completedAt,
    },
  });

  return run.id;
}
