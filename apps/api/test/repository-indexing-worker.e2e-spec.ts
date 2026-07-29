import { INestApplication } from '@nestjs/common';
import { RepositoryStatus } from '@prisma/client';
import { mkdir, rm } from 'node:fs/promises';
import { PrismaService } from '../src/prisma/prisma.service';
import { RepositoryIndexingQueueService } from '../src/repositories/repository-indexing.queue.service';
import { RepositoryChunkService } from '../src/repositories/indexing/repository-chunk.service';
import { RepositoryCloneService } from '../src/repositories/indexing/repository-clone.service';
import {
  EmbedJobData,
  ReindexJobData,
} from '../src/repositories/indexing/indexing-job.types';
import { IndexingStorageService } from '../src/repositories/indexing/indexing-storage.service';
import { RepositoryEmbeddingService } from '../src/repositories/indexing/repository-embedding.service';
import { RepositoryIndexingWorkerService } from '../src/repositories/indexing/repository-indexing.worker.service';
import { RepositoryParseService } from '../src/repositories/indexing/repository-parse.service';
import { signUp } from './helpers/factories';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

type WorkerInternals = {
  processReindex(data: ReindexJobData): Promise<void>;
  processClone(data: ReindexJobData & { runId: string }): Promise<void>;
  processParse(
    data: ReindexJobData & { runId: string; clonePath: string },
  ): Promise<void>;
  processChunk(
    data: ReindexJobData & { runId: string; clonePath: string },
  ): Promise<void>;
  processEmbed(data: EmbedJobData): Promise<void>;
  handleWorkerFailure(
    job: { data: unknown } | undefined,
    error: Error,
  ): Promise<void>;
};

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

describeE2e('Repository indexing worker orchestration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    const context = await createE2eApp();
    app = context.app;
    prisma = context.prisma;
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  async function createRepositoryFixture(): Promise<{
    workspaceId: string;
    userId: string;
    repositoryId: string;
  }> {
    const auth = await signUp(app);
    const repository = await prisma.repository.create({
      data: {
        workspaceId: auth.activeWorkspace.id,
        provider: 'GITHUB',
        externalId: `repo-${Date.now()}`,
        owner: 'acme',
        name: 'platform-api',
        fullName: 'acme/platform-api',
        defaultBranch: 'main',
        status: RepositoryStatus.PENDING,
      },
    });

    return {
      workspaceId: auth.activeWorkspace.id,
      userId: auth.user.id,
      repositoryId: repository.id,
    };
  }

  it('runs reindex -> clone -> parse -> chunk -> embed and marks repository ready', async () => {
    const fixture = await createRepositoryFixture();
    const queueService = app.get(RepositoryIndexingQueueService);
    const worker = app.get(RepositoryIndexingWorkerService);
    const cloneService = app.get(RepositoryCloneService);
    const parseService = app.get(RepositoryParseService);
    const chunkService = app.get(RepositoryChunkService);
    const embeddingService = app.get(RepositoryEmbeddingService);
    const storageService = app.get(IndexingStorageService);
    const internals = worker as unknown as WorkerInternals;

    const enqueueCloneSpy = jest
      .spyOn(queueService, 'enqueueCloneJob')
      .mockResolvedValue(undefined);
    const enqueueParseSpy = jest
      .spyOn(queueService, 'enqueueParseJob')
      .mockResolvedValue(undefined);
    const enqueueChunkSpy = jest
      .spyOn(queueService, 'enqueueChunkJob')
      .mockResolvedValue(undefined);
    const enqueueEmbedSpy = jest
      .spyOn(queueService, 'enqueueEmbedJob')
      .mockResolvedValue(undefined);
    jest
      .spyOn(embeddingService, 'deleteRepositoryVectors')
      .mockResolvedValue(undefined);
    jest.spyOn(embeddingService, 'embedRepository').mockResolvedValue({
      embeddedCount: 39,
    });
    jest.spyOn(cloneService, 'cloneRepository').mockResolvedValue({
      clonePath: '/tmp/indexing/run-1/repo',
      branch: 'develop',
      commitSha: 'abc123def',
    });
    await mkdir('/tmp/indexing/run-1/repo', { recursive: true });
    jest.spyOn(parseService, 'parseRepository').mockResolvedValue({
      supportedFileCount: 12,
      ignoredFileCount: 4,
      symbolCount: 22,
    });
    jest.spyOn(chunkService, 'chunkRepository').mockResolvedValue({
      chunkCount: 39,
    });
    const cleanupSpy = jest
      .spyOn(storageService, 'cleanupRunDirectory')
      .mockImplementation(async () => {
        await rm('/tmp/indexing/run-1', { recursive: true, force: true });
      });

    const reindexData: ReindexJobData = {
      workspaceId: fixture.workspaceId,
      repositoryId: fixture.repositoryId,
      userId: fixture.userId,
      branch: 'develop',
      trigger: 'MANUAL_REINDEX',
    };

    await internals.processReindex(reindexData);
    expect(enqueueCloneSpy).toHaveBeenCalledTimes(1);

    const run = await prisma.indexingRun.findFirstOrThrow({
      where: { repositoryId: fixture.repositoryId },
      orderBy: { startedAt: 'desc' },
    });
    expect(run.status).toBe('RUNNING');
    expect(run.trigger).toBe('MANUAL_REINDEX');

    await internals.processClone({ ...reindexData, runId: run.id });
    expect(enqueueParseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: fixture.repositoryId,
        runId: run.id,
        clonePath: '/tmp/indexing/run-1/repo',
        branch: 'develop',
      }),
    );

    await internals.processParse({
      ...reindexData,
      runId: run.id,
      clonePath: '/tmp/indexing/run-1/repo',
    });
    expect(enqueueChunkSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: fixture.repositoryId,
        runId: run.id,
      }),
    );

    await internals.processChunk({
      ...reindexData,
      runId: run.id,
      clonePath: '/tmp/indexing/run-1/repo',
    });
    expect(enqueueEmbedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: fixture.repositoryId,
        runId: run.id,
      }),
    );

    const afterChunkRepository = await prisma.repository.findUniqueOrThrow({
      where: { id: fixture.repositoryId },
    });
    expect(afterChunkRepository.status).toBe(RepositoryStatus.EMBEDDING);

    await internals.processEmbed({
      ...reindexData,
      runId: run.id,
      clonePath: '/tmp/indexing/run-1/repo',
    });

    const updatedRepository = await prisma.repository.findUniqueOrThrow({
      where: { id: fixture.repositoryId },
    });
    const updatedRun = await prisma.indexingRun.findUniqueOrThrow({
      where: { id: run.id },
    });

    expect(updatedRepository.status).toBe(RepositoryStatus.READY);
    expect(updatedRepository.indexingError).toBeNull();
    expect(updatedRepository.lastIndexedAt).not.toBeNull();
    expect(updatedRun.status).toBe('SUCCEEDED');
    expect(updatedRun.completedAt).not.toBeNull();
    expect(updatedRun.chunkCount).toBe(39);
    expect(updatedRun.embeddingCount).toBe(39);
    expect(cleanupSpy).toHaveBeenCalledWith(run.id);
  });

  it('marks indexing run and repository as failed when worker handler runs', async () => {
    const fixture = await createRepositoryFixture();
    const queueService = app.get(RepositoryIndexingQueueService);
    const worker = app.get(RepositoryIndexingWorkerService);
    const embeddingService = app.get(RepositoryEmbeddingService);
    const storageService = app.get(IndexingStorageService);
    const internals = worker as unknown as WorkerInternals;

    jest.spyOn(queueService, 'enqueueCloneJob').mockResolvedValue(undefined);
    jest
      .spyOn(embeddingService, 'deleteRepositoryVectors')
      .mockResolvedValue(undefined);
    const cleanupSpy = jest
      .spyOn(storageService, 'cleanupRunDirectory')
      .mockResolvedValue(undefined);

    await internals.processReindex({
      workspaceId: fixture.workspaceId,
      repositoryId: fixture.repositoryId,
      userId: fixture.userId,
      branch: 'main',
      trigger: 'MANUAL_RETRY',
    });

    const run = await prisma.indexingRun.findFirstOrThrow({
      where: { repositoryId: fixture.repositoryId },
      orderBy: { startedAt: 'desc' },
    });

    await internals.handleWorkerFailure(
      {
        data: {
          workspaceId: fixture.workspaceId,
          repositoryId: fixture.repositoryId,
          runId: run.id,
        },
      },
      new Error('Parse failed: malformed content'),
    );

    const failedRun = await prisma.indexingRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    const failedRepository = await prisma.repository.findUniqueOrThrow({
      where: { id: fixture.repositoryId },
    });

    expect(failedRun.status).toBe('FAILED');
    expect(failedRun.error).toContain('Parse failed');
    expect(failedRun.completedAt).not.toBeNull();
    expect(cleanupSpy).toHaveBeenCalledWith(run.id);
    expect(failedRepository.status).toBe(RepositoryStatus.FAILED);
    expect(failedRepository.indexingError).toContain('Parse failed');
  });
});
