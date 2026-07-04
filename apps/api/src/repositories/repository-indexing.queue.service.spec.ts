import { ConfigService } from '@nestjs/config';
import { RepositoryStatus } from '@prisma/client';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('RepositoryIndexingQueueService', () => {
  it('progresses indexing states in process mode', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const repositoriesRepository = {
      updateStatus: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    const service = new RepositoryIndexingQueueService(
      configService,
      repositoriesRepository,
    );

    service.onModuleInit();
    await service.enqueueIndexing('workspace-1', 'repo-1');
    await sleep(700);

    expect(repositoriesRepository.updateStatus).toHaveBeenNthCalledWith(
      1,
      'workspace-1',
      'repo-1',
      expect.objectContaining({ status: RepositoryStatus.CLONING }),
    );
    expect(repositoriesRepository.updateStatus).toHaveBeenNthCalledWith(
      2,
      'workspace-1',
      'repo-1',
      expect.objectContaining({ status: RepositoryStatus.PARSING }),
    );
    expect(repositoriesRepository.updateStatus).toHaveBeenNthCalledWith(
      3,
      'workspace-1',
      'repo-1',
      expect.objectContaining({ status: RepositoryStatus.EMBEDDING }),
    );
    expect(repositoriesRepository.updateStatus).toHaveBeenNthCalledWith(
      4,
      'workspace-1',
      'repo-1',
      expect.objectContaining({ status: RepositoryStatus.READY }),
    );
  });

  it('marks repository as failed when step errors', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const repositoriesRepository = {
      updateStatus: jest
        .fn()
        .mockImplementation(
          (
            _workspaceId: string,
            _repoId: string,
            params: { status: RepositoryStatus },
          ) => {
            if (params.status === RepositoryStatus.PARSING) {
              throw new Error('Parse failed');
            }
            return {};
          },
        ),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    const service = new RepositoryIndexingQueueService(
      configService,
      repositoriesRepository,
    );

    service.onModuleInit();
    await service.enqueueIndexing('workspace-1', 'repo-1');
    await sleep(500);

    expect(repositoriesRepository.updateStatus).toHaveBeenCalledWith(
      'workspace-1',
      'repo-1',
      expect.objectContaining({
        status: RepositoryStatus.FAILED,
      }),
    );
  });
});
