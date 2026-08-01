import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
  RepositoryStatus,
  WorkspaceRole,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { OnboardingGuideQueueService } from '../src/modules/onboarding/queue/onboarding-guide-queue.service';
import type { ManualGuideGenerationRequest } from '../src/modules/onboarding/queue/onboarding-guide-queue.types';
import type { OnboardingGuideGenerationRun } from '../src/modules/onboarding/types/guide-generation-run.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, signUp } from './helpers/factories';
import {
  closeE2eApp,
  configureTestEnvironment,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

const generatedAt = new Date('2026-07-31T18:00:00.000Z');
const runIds = {
  [GuideGenerationTrigger.MANUAL_GENERATE]:
    '00000000-0000-4000-8000-000000000001',
  [GuideGenerationTrigger.MANUAL_REGENERATE]:
    '00000000-0000-4000-8000-000000000002',
} as const;

function buildQueuedRun(
  requestData: ManualGuideGenerationRequest,
  trigger:
    | typeof GuideGenerationTrigger.MANUAL_GENERATE
    | typeof GuideGenerationTrigger.MANUAL_REGENERATE,
): OnboardingGuideGenerationRun {
  return {
    id: runIds[trigger],
    workspaceId: requestData.workspaceId,
    repositoryId: requestData.repositoryId,
    trigger,
    status: GuideGenerationStatus.QUEUED,
    requestedTypes: requestData.requestedTypes ?? Object.values(GuideType),
    totalGuideCount: 0,
    completedGuideCount: 0,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    error: null,
    errors: null,
    createdAt: generatedAt,
    startedAt: null,
    completedAt: null,
    updatedAt: generatedAt,
  };
}

describeE2e('Onboarding guides (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enqueueManualGenerate: jest.Mock;
  let enqueueManualRegenerate: jest.Mock;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    configureTestEnvironment();

    enqueueManualGenerate = jest.fn(
      (requestData: ManualGuideGenerationRequest) =>
        Promise.resolve(
          buildQueuedRun(requestData, GuideGenerationTrigger.MANUAL_GENERATE),
        ),
    );
    enqueueManualRegenerate = jest.fn(
      (requestData: ManualGuideGenerationRequest) =>
        Promise.resolve(
          buildQueuedRun(requestData, GuideGenerationTrigger.MANUAL_REGENERATE),
        ),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OnboardingGuideQueueService)
      .useValue({
        waitUntilReady: jest.fn().mockResolvedValue(undefined),
        enqueueManualGenerate,
        enqueueManualRegenerate,
        enqueuePostIndexGeneration: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  async function seedReadyRepository(workspaceId: string, name: string) {
    const suffix = `${name}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    return prisma.repository.create({
      data: {
        workspaceId,
        provider: 'GITHUB',
        externalId: suffix,
        owner: 'architect-ai',
        name,
        fullName: `architect-ai/${suffix}`,
        defaultBranch: 'main',
        status: RepositoryStatus.READY,
        lastIndexedAt: generatedAt,
      },
    });
  }

  async function seedGuide(
    workspaceId: string,
    repositoryId: string,
    data: {
      type: GuideType;
      slug: string;
      title: string;
      markdown: string;
      summary?: string;
    },
  ) {
    return prisma.guide.create({
      data: {
        workspaceId,
        repositoryId,
        type: data.type,
        slug: data.slug,
        title: data.title,
        markdown: data.markdown,
        summary: data.summary,
        metadata: { seededBy: 'onboarding-guides.e2e' },
      },
    });
  }

  it('allows every workspace role to list and get guides, but rejects outsiders', async () => {
    const owner = await signUp(app);
    const admin = await signUp(app);
    const member = await signUp(app);
    const viewer = await signUp(app);
    const outsider = await signUp(app);
    const workspaceId = owner.activeWorkspace.id;

    await prisma.membership.createMany({
      data: [
        {
          workspaceId,
          userId: admin.user.id,
          role: WorkspaceRole.ADMIN,
          status: 'ACTIVE',
        },
        {
          workspaceId,
          userId: member.user.id,
          role: WorkspaceRole.MEMBER,
          status: 'ACTIVE',
        },
        {
          workspaceId,
          userId: viewer.user.id,
          role: WorkspaceRole.VIEWER,
          status: 'ACTIVE',
        },
      ],
    });

    const repository = await seedReadyRepository(workspaceId, 'roles');
    const guide = await seedGuide(workspaceId, repository.id, {
      type: GuideType.PROJECT_OVERVIEW,
      slug: 'project-overview',
      title: 'Project overview',
      markdown: '# Project overview',
    });
    const basePath = `/workspaces/${workspaceId}/repositories/${repository.id}/guides`;

    for (const auth of [owner, admin, member, viewer]) {
      const { body: list } = await request(app.getHttpServer())
        .get(basePath)
        .set(authHeader(auth.accessToken))
        .expect(200);
      expect(list.guides).toEqual([
        expect.objectContaining({
          id: guide.id,
          workspaceId,
          repositoryId: repository.id,
        }),
      ]);

      const { body: detail } = await request(app.getHttpServer())
        .get(`${basePath}/${guide.id}`)
        .set(authHeader(auth.accessToken))
        .expect(200);
      expect(detail).toEqual(
        expect.objectContaining({
          id: guide.id,
          type: GuideType.PROJECT_OVERVIEW,
          title: 'Project overview',
        }),
      );
    }

    await request(app.getHttpServer())
      .get(basePath)
      .set(authHeader(outsider.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`${basePath}/${guide.id}`)
      .set(authHeader(outsider.accessToken))
      .expect(403);
  });

  it('isolates repositories and returns 404 for cross-scope or unknown guides', async () => {
    const owner = await signUp(app);
    const { body: otherWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(owner.accessToken))
      .send({ name: 'Other Guides Workspace' })
      .expect(201);

    const repository = await seedReadyRepository(
      owner.activeWorkspace.id,
      'primary',
    );
    const otherRepository = await seedReadyRepository(
      otherWorkspace.id,
      'other',
    );
    const guide = await seedGuide(owner.activeWorkspace.id, repository.id, {
      type: GuideType.EXECUTIVE_SUMMARY,
      slug: 'executive-summary',
      title: 'Executive summary',
      markdown: '# Executive summary',
    });
    const otherGuide = await seedGuide(otherWorkspace.id, otherRepository.id, {
      type: GuideType.GLOSSARY,
      slug: 'glossary',
      title: 'Other glossary',
      markdown: '# Other glossary',
    });
    const basePath = `/workspaces/${owner.activeWorkspace.id}/repositories/${repository.id}/guides`;

    const { body } = await request(app.getHttpServer())
      .get(basePath)
      .set(authHeader(owner.accessToken))
      .expect(200);
    const list = body as { guides: Array<{ id: string }> };
    expect(list.guides.map((listed: { id: string }) => listed.id)).toEqual([
      guide.id,
    ]);

    await request(app.getHttpServer())
      .get(
        `/workspaces/${otherWorkspace.id}/repositories/${repository.id}/guides`,
      )
      .set(authHeader(owner.accessToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`${basePath}/${otherGuide.id}`)
      .set(authHeader(owner.accessToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`${basePath}/00000000-0000-4000-8000-000000000099`)
      .set(authHeader(owner.accessToken))
      .expect(404);
  });

  it('lists repository guides and filters by type or case-insensitive search', async () => {
    const owner = await signUp(app);
    const workspaceId = owner.activeWorkspace.id;
    const repository = await seedReadyRepository(workspaceId, 'searchable');
    const otherRepository = await seedReadyRepository(workspaceId, 'excluded');

    const overview = await seedGuide(workspaceId, repository.id, {
      type: GuideType.PROJECT_OVERVIEW,
      slug: 'project-overview',
      title: 'Project overview',
      markdown: 'A quick tour of the platform.',
      summary: 'Start here',
    });
    const glossary = await seedGuide(workspaceId, repository.id, {
      type: GuideType.GLOSSARY,
      slug: 'domain-glossary',
      title: 'Domain language',
      markdown: 'Defines the QUASAR processing term.',
    });
    await seedGuide(workspaceId, repository.id, {
      type: GuideType.COMMON_PITFALLS,
      slug: 'common-pitfalls',
      title: 'Common pitfalls',
      markdown: 'Avoid stale generated clients.',
    });
    await seedGuide(workspaceId, otherRepository.id, {
      type: GuideType.GLOSSARY,
      slug: 'other-glossary',
      title: 'Excluded repository glossary',
      markdown: 'QUASAR should not leak between repositories.',
    });

    const basePath = `/workspaces/${workspaceId}/repositories/${repository.id}/guides`;
    const { body } = await request(app.getHttpServer())
      .get(basePath)
      .set(authHeader(owner.accessToken))
      .expect(200);
    const all = body as { total: number; guides: Array<{ id: string }> };
    expect(all.total).toBe(3);
    expect(all.guides.map((guide: { id: string }) => guide.id)).toEqual(
      expect.arrayContaining([overview.id, glossary.id]),
    );

    const { body: byType } = await request(app.getHttpServer())
      .get(basePath)
      .query({ type: GuideType.GLOSSARY })
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(byType).toEqual(
      expect.objectContaining({
        total: 1,
        guides: [expect.objectContaining({ id: glossary.id })],
      }),
    );

    const { body: bySearch } = await request(app.getHttpServer())
      .get(basePath)
      .query({ q: 'quasar' })
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(bySearch).toEqual(
      expect.objectContaining({
        total: 1,
        guides: [expect.objectContaining({ id: glossary.id })],
      }),
    );
  });

  it('returns 202 for generate and regenerate with the deterministic queue fake', async () => {
    const owner = await signUp(app);
    const member = await signUp(app);
    const viewer = await signUp(app);
    const workspaceId = owner.activeWorkspace.id;
    await prisma.membership.createMany({
      data: [
        {
          workspaceId,
          userId: member.user.id,
          role: WorkspaceRole.MEMBER,
          status: 'ACTIVE',
        },
        {
          workspaceId,
          userId: viewer.user.id,
          role: WorkspaceRole.VIEWER,
          status: 'ACTIVE',
        },
      ],
    });
    const repository = await seedReadyRepository(workspaceId, 'generation');
    const basePath = `/workspaces/${workspaceId}/repositories/${repository.id}/guides`;

    const { body: generated } = await request(app.getHttpServer())
      .post(`${basePath}/generate`)
      .set(authHeader(owner.accessToken))
      .send({ types: [GuideType.PROJECT_OVERVIEW] })
      .expect(202);
    expect(generated).toEqual(
      expect.objectContaining({
        id: runIds.MANUAL_GENERATE,
        workspaceId,
        repositoryId: repository.id,
        trigger: GuideGenerationTrigger.MANUAL_GENERATE,
        status: GuideGenerationStatus.QUEUED,
        requestedTypes: [GuideType.PROJECT_OVERVIEW],
      }),
    );

    const { body: regenerated } = await request(app.getHttpServer())
      .post(`${basePath}/regenerate`)
      .set(authHeader(member.accessToken))
      .send({ types: [GuideType.GLOSSARY] })
      .expect(202);
    expect(regenerated).toEqual(
      expect.objectContaining({
        id: runIds.MANUAL_REGENERATE,
        trigger: GuideGenerationTrigger.MANUAL_REGENERATE,
        requestedTypes: [GuideType.GLOSSARY],
      }),
    );

    expect(enqueueManualGenerate).toHaveBeenCalledWith({
      workspaceId,
      repositoryId: repository.id,
      requestedTypes: [GuideType.PROJECT_OVERVIEW],
    });
    expect(enqueueManualRegenerate).toHaveBeenCalledWith({
      workspaceId,
      repositoryId: repository.id,
      requestedTypes: [GuideType.GLOSSARY],
    });

    await request(app.getHttpServer())
      .post(`${basePath}/generate`)
      .set(authHeader(viewer.accessToken))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`${basePath}/regenerate`)
      .set(authHeader(viewer.accessToken))
      .send({})
      .expect(403);
  });
});
