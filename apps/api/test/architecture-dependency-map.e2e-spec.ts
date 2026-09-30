import { INestApplication } from '@nestjs/common';
import {
  CodeSymbolType,
  IndexingRunStatus,
  IndexingTrigger,
  RepositoryStatus,
  SymbolRelationType,
} from '@prisma/client';
import request from 'supertest';
import { DependencyGraphProvider } from '../src/modules/architecture/dependency-mapping/dependency-graph.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';
import { authHeader, connectRepository, signUp } from './helpers/factories';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

interface SeedFile {
  path: string;
  language?: string;
}

interface SeedImport {
  from: string;
  targetFilePath: string | null;
  targetQualifiedName: string;
}

/**
 * Writes an indexing revision that looks exactly like one the indexing worker
 * would leave behind: files, one MODULE symbol per file, and import relations
 * attached to those module symbols.
 */
async function seedRevision(
  prisma: PrismaService,
  repositoryId: string,
  options: {
    files: SeedFile[];
    imports?: SeedImport[];
    commitSha?: string;
    branch?: string;
    completedAt?: Date;
  },
): Promise<string> {
  const run = await prisma.indexingRun.create({
    data: {
      repositoryId,
      trigger: IndexingTrigger.INITIAL_CONNECT,
      status: IndexingRunStatus.SUCCEEDED,
      branch: options.branch ?? 'main',
      commitSha: options.commitSha ?? 'commit-sha-1',
      completedAt: options.completedAt ?? new Date(),
    },
  });

  for (const file of options.files) {
    await prisma.repositoryFile.create({
      data: {
        repositoryId,
        indexingRunId: run.id,
        path: file.path,
        language: file.language ?? 'typescript',
        contentHash: `hash-${file.path}`,
        size: 100,
        lineCount: 20,
        extension: file.path.slice(file.path.lastIndexOf('.')),
      },
    });
  }

  const moduleSymbolIdByPath = new Map<string, string>();
  for (const file of options.files) {
    const symbol = await prisma.codeSymbol.create({
      data: {
        repositoryId,
        indexingRunId: run.id,
        filePath: file.path,
        type: CodeSymbolType.MODULE,
        name: file.path,
        qualifiedName: file.path,
        language: file.language ?? 'typescript',
        startLine: 1,
        endLine: 20,
        startColumn: 0,
        endColumn: 0,
      },
    });
    moduleSymbolIdByPath.set(file.path, symbol.id);
  }

  for (const relation of options.imports ?? []) {
    const fromSymbolId = moduleSymbolIdByPath.get(relation.from);
    if (!fromSymbolId) {
      throw new Error(`No module symbol seeded for ${relation.from}`);
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
    data: { status: RepositoryStatus.READY, lastIndexedAt: new Date() },
  });

  return run.id;
}

describeE2e('Architecture dependency map (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    const context = await createE2eApp();
    app = context.app;
    prisma = context.prisma;
    await resetDatabase(context.prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  it('presents modules and the revision for a repository with a successful index', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );

    const runId = await seedRevision(prisma, repository.id, {
      files: [
        { path: 'src/features/auth.ts' },
        { path: 'src/features/billing.ts' },
        { path: 'src/shared/logger.ts' },
        { path: 'src/shared/config.ts' },
      ],
      imports: [
        {
          from: 'src/features/auth.ts',
          targetFilePath: '../shared/logger',
          targetQualifiedName: 'logger',
        },
      ],
      commitSha: 'deadbeef',
      branch: 'main',
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.state).toBe('READY');
    expect(body.repositoryId).toBe(repository.id);
    expect(body.revision).toEqual(
      expect.objectContaining({
        indexingRunId: runId,
        commitSha: 'deadbeef',
        branch: 'main',
      }),
    );
    const modules = body.modules as Array<{ key: string }>;
    expect(modules.map((module) => module.key)).toEqual(
      expect.arrayContaining(['src/features', 'src/shared']),
    );
    expect(body.groupingRules.length).toBeGreaterThan(0);
    expect(body.limitations.length).toBeGreaterThan(0);
    expect(body.totals.dependencyCount).toBe(1);
  });

  it('presents direct dependencies, dependents and their evidence', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [
        { path: 'src/features/auth.ts' },
        { path: 'src/features/billing.ts' },
        { path: 'src/shared/logger.ts' },
        { path: 'src/shared/config.ts' },
      ],
      imports: [
        {
          from: 'src/features/auth.ts',
          targetFilePath: '../shared/logger',
          targetQualifiedName: 'logger',
        },
      ],
    });

    const base = `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const { body: dependant } = await request(app.getHttpServer())
      .get(`${base}/module`)
      .query({ key: 'src/features' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(dependant.dependencies).toEqual([
      expect.objectContaining({
        relatedModuleKey: 'src/shared',
        confidence: 'RESOLVED',
        supportingRelationCount: 1,
        relationTypes: ['IMPORTS'],
      }),
    ]);
    expect(dependant.dependents).toEqual([]);
    expect(dependant.files.length).toBeGreaterThan(0);

    const { body: dependency } = await request(app.getHttpServer())
      .get(`${base}/module`)
      .query({ key: 'src/shared' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(dependency.dependents).toEqual([
      expect.objectContaining({ relatedModuleKey: 'src/features' }),
    ]);

    const { body: evidence } = await request(app.getHttpServer())
      .get(`${base}/evidence`)
      .query({ from: 'src/features', to: 'src/shared' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(evidence.confidence).toBe('RESOLVED');
    expect(evidence.items).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({
          filePath: 'src/features/auth.ts',
          repositoryId: repository.id,
        }),
        target: expect.objectContaining({ filePath: 'src/shared/logger.ts' }),
        observedTarget: '../shared/logger',
        resolutionStrategy: 'RELATIVE_PATH',
      }),
    ]);
  });

  it('reports unresolved targets instead of drawing a dependency', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [
        { path: 'src/Http/Kernel.php', language: 'php' },
        { path: 'src/Http/Router.php', language: 'php' },
        { path: 'src/Models/User.php', language: 'php' },
        { path: 'src/Models/Order.php', language: 'php' },
      ],
      imports: [
        {
          from: 'src/Http/Kernel.php',
          targetFilePath: null,
          targetQualifiedName: 'App\\Models\\User',
        },
      ],
    });

    const base = `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const { body: map } = await request(app.getHttpServer())
      .get(base)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(map.state).toBe('NO_DEPENDENCIES');
    expect(map.modules.length).toBe(2);
    expect(map.totals.unresolvedRelationCount).toBe(1);

    const { body: module } = await request(app.getHttpServer())
      .get(`${base}/module`)
      .query({ key: 'src/Http' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(module.dependencies).toEqual([]);
    expect(module.unresolved).toEqual([
      expect.objectContaining({
        confidence: 'UNRESOLVED',
        targetName: 'App\\Models\\User',
        reason: 'NO_TARGET_PATH_RECORDED',
      }),
    ]);
  });

  it('explains a revision in which no module could be identified', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [
        { path: 'test/one.spec.ts' },
        { path: 'test/two.spec.ts' },
        { path: 'dist/bundle.js', language: 'javascript' },
        { path: 'dist/vendor.js', language: 'javascript' },
      ],
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.state).toBe('NO_MODULES');
    expect(body.modules).toEqual([]);
    expect(body.exclusions.length).toBeGreaterThan(0);
    expect(body.groupingRules.length).toBeGreaterThan(0);
  });

  it('presents an unavailable state when indexing never completed', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    // A live indexing queue leaves the repository PENDING. CI has no Redis, so
    // connect marks it FAILED. Pin the terminal status this case describes.
    await prisma.repository.update({
      where: { id: repository.id },
      data: { status: RepositoryStatus.FAILED },
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.state).toBe('NO_INDEX');
    expect(body.rebuildInProgress).toBe(false);
    expect(body.revision).toBeNull();
    expect(body.modules).toEqual([]);
  });

  it('presents a rebuilding state when the first index is still running', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await prisma.repository.update({
      where: { id: repository.id },
      data: { status: RepositoryStatus.PARSING },
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.state).toBe('REBUILDING');
    expect(body.rebuildInProgress).toBe(true);
    expect(body.revision).toBeNull();
    expect(body.modules).toEqual([]);
  });

  it('keeps every part of one view on the same indexing revision', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );

    await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/old/a.ts' }, { path: 'src/old/b.ts' }],
      commitSha: 'older-commit',
      completedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const newerRunId = await seedRevision(prisma, repository.id, {
      files: [
        { path: 'src/features/auth.ts' },
        { path: 'src/features/billing.ts' },
        { path: 'src/shared/logger.ts' },
        { path: 'src/shared/config.ts' },
      ],
      imports: [
        {
          from: 'src/features/auth.ts',
          targetFilePath: '../shared/logger',
          targetQualifiedName: 'logger',
        },
      ],
      commitSha: 'newer-commit',
      completedAt: new Date('2026-06-20T00:00:00.000Z'),
    });

    const base = `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const { body: map } = await request(app.getHttpServer())
      .get(base)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(map.revision.indexingRunId).toBe(newerRunId);
    expect(map.revision.commitSha).toBe('newer-commit');
    const modules = map.modules as Array<{ key: string }>;
    expect(modules.map((module) => module.key)).not.toContain('src/old');

    const { body: module } = await request(app.getHttpServer())
      .get(`${base}/module`)
      .query({ key: 'src/features' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(module.revision.indexingRunId).toBe(newerRunId);
    const files = module.files as Array<{ path: string }>;
    expect(files.every((file) => file.path.startsWith('src/features/'))).toBe(
      true,
    );
  });

  it('rejects architecture reads for a repository in another workspace', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [
        { path: 'src/features/auth.ts' },
        { path: 'src/features/billing.ts' },
        { path: 'src/shared/logger.ts' },
        { path: 'src/shared/config.ts' },
      ],
      imports: [
        {
          from: 'src/features/auth.ts',
          targetFilePath: '../shared/logger',
          targetQualifiedName: 'logger',
        },
      ],
    });

    const { body: otherWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Other Workspace' })
      .expect(201);

    const foreignBase = `/workspaces/${otherWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const { body: mapError } = await request(app.getHttpServer())
      .get(foreignBase)
      .set(authHeader(auth.accessToken))
      .expect(404);

    expect(JSON.stringify(mapError)).not.toContain('src/features');
    expect(JSON.stringify(mapError)).not.toContain('src/shared');

    await request(app.getHttpServer())
      .get(`${foreignBase}/module`)
      .query({ key: 'src/features' })
      .set(authHeader(auth.accessToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${foreignBase}/evidence`)
      .query({ from: 'src/features', to: 'src/shared' })
      .set(authHeader(auth.accessToken))
      .expect(404);
  });

  it('denies architecture reads to users outside the workspace', async () => {
    const owner = await signUp(app);
    const repository = await connectRepository(
      app,
      owner.accessToken,
      owner.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
    });

    const outsider = await signUp(app);

    await request(app.getHttpServer())
      .get(
        `/workspaces/${owner.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(outsider.accessToken))
      .expect(403);
  });

  it('rejects a module key that does not exist in the revision', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
    });

    await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map/module`,
      )
      .query({ key: 'src/does-not-exist' })
      .set(authHeader(auth.accessToken))
      .expect(404);
  });

  it('keeps the previous revision labeled while a rebuild is running', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const runId = await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
      commitSha: 'previous-sha',
    });
    await prisma.repository.update({
      where: { id: repository.id },
      data: { status: RepositoryStatus.PARSING },
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.rebuildInProgress).toBe(true);
    expect(body.revision.indexingRunId).toBe(runId);
    expect(body.revision.commitSha).toBe('previous-sha');
    const modules = body.modules as Array<{ key: string }>;
    expect(modules.map((module) => module.key)).toContain('src/app');
    expect(body.state).not.toBe('NO_INDEX');
  });

  it('bounds a large graph and finds a module outside that page by search', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const files: SeedFile[] = [];
    for (let index = 0; index < 41; index += 1) {
      const folder = `pkg/m${String(index).padStart(2, '0')}`;
      files.push({ path: `${folder}/a.ts` }, { path: `${folder}/b.ts` });
    }
    await seedRevision(prisma, repository.id, { files });
    const base = `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const bounded = await request(app.getHttpServer())
      .get(base)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(bounded.body.focusedExplorationRequired).toBe(true);
    expect(bounded.body.moduleBounds.truncated).toBe(true);
    expect(bounded.body.moduleBounds.returned).toBe(40);
    expect(bounded.body.modules).toHaveLength(40);
    const boundedModules = bounded.body.modules as Array<{ key: string }>;
    expect(boundedModules.map((module) => module.key)).not.toContain('pkg/m40');

    const found = await request(app.getHttpServer())
      .get(base)
      .query({ q: 'm40' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    const foundModules = found.body.modules as Array<{ key: string }>;
    expect(foundModules.map((module) => module.key)).toEqual(['pkg/m40']);
    expect(found.body.moduleBounds).toEqual({
      limit: 40,
      returned: 1,
      total: 1,
      truncated: false,
    });
    expect(found.body.focusedExplorationRequired).toBe(true);
  });

  it('reports a newer succeeded revision without replacing the pinned view', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const older = await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
      commitSha: 'older-sha',
      completedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const newer = await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/web/a.ts' }, { path: 'src/web/b.ts' }],
      commitSha: 'newer-sha',
      completedAt: new Date('2026-09-02T00:00:00.000Z'),
    });
    const base = `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`;

    const pinned = await request(app.getHttpServer())
      .get(base)
      .query({ indexingRunId: older })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(pinned.body.revision.indexingRunId).toBe(older);
    expect(pinned.body.newerRevisionAvailable).toBe(true);
    const pinnedModules = pinned.body.modules as Array<{ key: string }>;
    expect(pinnedModules.map((module) => module.key)).toEqual(['src/app']);

    const latest = await request(app.getHttpServer())
      .get(base)
      .set(authHeader(auth.accessToken))
      .expect(200);
    expect(latest.body.revision.indexingRunId).toBe(newer);
    expect(latest.body.newerRevisionAvailable).toBe(false);
  });

  it('discloses when notable symbols are truncated', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    const runId = await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
    });
    for (let index = 0; index < 51; index += 1) {
      await prisma.codeSymbol.create({
        data: {
          repositoryId: repository.id,
          indexingRunId: runId,
          filePath: 'src/app/a.ts',
          type: CodeSymbolType.FUNCTION,
          name: `fn${index}`,
          qualifiedName: `fn${index}`,
          language: 'typescript',
          startLine: index + 1,
          endLine: index + 1,
          startColumn: 0,
          endColumn: 0,
          exported: true,
        },
      });
    }

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map/module`,
      )
      .query({ key: 'src/app' })
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.symbolBounds).toEqual({
      limit: 50,
      returned: 50,
      total: 51,
      truncated: true,
    });
    expect(body.notableSymbols).toHaveLength(50);
  });

  it('returns a sanitized error when the dependency view cannot be derived', async () => {
    const auth = await signUp(app);
    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );
    await seedRevision(prisma, repository.id, {
      files: [{ path: 'src/app/a.ts' }, { path: 'src/app/b.ts' }],
    });
    jest
      .spyOn(app.get(DependencyGraphProvider), 'getGraph')
      .mockRejectedValue(
        new Error('sk-live-SECRET at /home/developer/secret.ts:12'),
      );

    const { body } = await request(app.getHttpServer())
      .get(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}/architecture/dependency-map`,
      )
      .set(authHeader(auth.accessToken))
      .expect(500);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('sk-live');
    expect(serialized).not.toContain('/home/developer');
    expect(body.error).toBe('Internal server error');
  });
});
