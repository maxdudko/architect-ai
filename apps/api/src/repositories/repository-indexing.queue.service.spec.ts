import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
    waitUntilReady: jest.fn(),
  })),
}));

describe('RepositoryIndexingQueueService', () => {
  it('enqueues initial indexing as reindex job', async () => {
    const configService = {
      get: jest.fn(() => 'redis://localhost:6379'),
    } as unknown as ConfigService;
    const repositoriesRepository = {
      updateStatus: jest.fn().mockResolvedValue({}),
      hasSucceededIndexingRun: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    const service = new RepositoryIndexingQueueService(
      configService,
      repositoriesRepository,
    );

    service.onModuleInit();
    await service.enqueueInitialIndexing({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      userId: 'user-1',
      branch: 'main',
    });

    const queueInstance = (Queue as unknown as jest.Mock).mock.results[0]
      .value as jest.Mocked<Queue>;
    expect(queueInstance.add).toHaveBeenCalledWith(
      'reindex',
      expect.objectContaining({
        workspaceId: 'workspace-1',
        repositoryId: 'repo-1',
        userId: 'user-1',
        branch: 'main',
        trigger: 'INITIAL_CONNECT',
      }),
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });

  it('marks repository failed from worker callback', async () => {
    const configService = {
      get: jest.fn(() => 'redis://localhost:6379'),
    } as unknown as ConfigService;
    const repositoriesRepository = {
      updateStatus: jest.fn().mockResolvedValue({}),
      hasSucceededIndexingRun: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    const service = new RepositoryIndexingQueueService(
      configService,
      repositoriesRepository,
    );

    service.onModuleInit();
    await service.markAsFailed({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      errorMessage: 'Parse failed',
    });

    expect(repositoriesRepository.updateStatus).toHaveBeenCalledTimes(1);
    expect(repositoriesRepository.updateStatus).toHaveBeenCalledWith(
      'workspace-1',
      'repo-1',
      expect.objectContaining({
        status: 'FAILED',
        indexingError: 'Parse failed',
      }),
    );
  });

  it('restores READY when a previous indexing run succeeded', async () => {
    const configService = {
      get: jest.fn(() => 'redis://localhost:6379'),
    } as unknown as ConfigService;
    const repositoriesRepository = {
      updateStatus: jest.fn().mockResolvedValue({}),
      hasSucceededIndexingRun: jest.fn().mockResolvedValue({ id: 'run-old' }),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    const service = new RepositoryIndexingQueueService(
      configService,
      repositoriesRepository,
    );

    service.onModuleInit();
    await service.markAsFailed({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      errorMessage: 'Embed failed',
    });

    expect(repositoriesRepository.updateStatus).toHaveBeenCalledWith(
      'workspace-1',
      'repo-1',
      expect.objectContaining({
        status: 'READY',
        indexingError: 'Embed failed',
      }),
    );
  });
});
