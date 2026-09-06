import { UnrecoverableError } from 'bullmq';
import { IndexingResourceMetric, RepositoryProvider } from '@prisma/client';
import { IndexingResourceLimitError } from '../../usage/indexing-resource-limit.error';
import { IndexingResourceLimitService } from '../../usage/indexing-resource-limit.service';
import { RepositoryIndexingWorkerService } from './repository-indexing.worker.service';

type WorkerInternals = {
  processReindex(data: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch?: string;
    trigger: 'INITIAL_CONNECT';
  }): Promise<void>;
  processClone(data: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    runId: string;
    branch?: string;
    trigger: 'INITIAL_CONNECT';
  }): Promise<void>;
};

describe('RepositoryIndexingWorkerService resource limits', () => {
  const jobData = {
    workspaceId: 'workspace-1',
    repositoryId: 'repo-1',
    userId: 'user-1',
    branch: 'main',
    trigger: 'INITIAL_CONNECT' as const,
  };

  let repositoriesRepository: {
    findById: jest.Mock;
    createIndexingRun: jest.Mock;
    updateIndexingRun: jest.Mock;
    updateStatus: jest.Mock;
  };
  let cloneService: { cloneRepository: jest.Mock };
  let indexingStorageService: {
    getWorkingTreeSize: jest.Mock;
    cleanupStaleDirectories: jest.Mock;
  };
  let githubIndexingEstimateService: { assertWithinLimits: jest.Mock };
  let indexingResourceLimitService: IndexingResourceLimitService;
  let queueService: { enqueueCloneJob: jest.Mock; enqueueParseJob: jest.Mock };
  let internals: WorkerInternals;

  beforeEach(() => {
    repositoriesRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'repo-1',
        provider: RepositoryProvider.GITHUB,
        owner: 'acme',
        name: 'app',
        defaultBranch: 'main',
      }),
      createIndexingRun: jest.fn(),
      updateIndexingRun: jest.fn(),
      updateStatus: jest.fn(),
    };
    cloneService = {
      cloneRepository: jest.fn().mockResolvedValue({
        clonePath: '/tmp/run/repo',
        branch: 'main',
        commitSha: 'abc',
      }),
    };
    indexingStorageService = {
      getWorkingTreeSize: jest.fn(),
      cleanupStaleDirectories: jest.fn(),
    };
    githubIndexingEstimateService = {
      assertWithinLimits: jest.fn().mockResolvedValue(undefined),
    };
    indexingResourceLimitService = new IndexingResourceLimitService({
      workspace: {
        findFirst: jest.fn().mockResolvedValue({ planId: 'plan-free' }),
      },
      planIndexingLimit: {
        findMany: jest.fn().mockResolvedValue([
          {
            metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
            maxValue: 262144000n,
          },
        ]),
      },
    } as never);
    queueService = {
      enqueueCloneJob: jest.fn(),
      enqueueParseJob: jest.fn(),
    };

    const worker = new RepositoryIndexingWorkerService(
      { get: jest.fn() } as never,
      repositoriesRepository as never,
      queueService as never,
      cloneService as never,
      {} as never,
      {} as never,
      {} as never,
      indexingStorageService as never,
      {} as never,
      { recordEvent: jest.fn() } as never,
      {} as never,
      indexingResourceLimitService,
      githubIndexingEstimateService as never,
    );
    internals = worker as unknown as WorkerInternals;
  });

  it('does not create an indexing run when the GitHub tree already exceeds the plan', async () => {
    githubIndexingEstimateService.assertWithinLimits.mockRejectedValue(
      new IndexingResourceLimitError(
        IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
        300_000_000,
        262_144_000,
        'too large',
      ),
    );

    await expect(internals.processReindex(jobData)).rejects.toBeInstanceOf(
      IndexingResourceLimitError,
    );
    expect(repositoriesRepository.createIndexingRun).not.toHaveBeenCalled();
  });

  it('rejects an oversized working tree after clone before parse is enqueued', async () => {
    indexingStorageService.getWorkingTreeSize.mockResolvedValue(300_000_000);

    await expect(
      internals.processClone({ ...jobData, runId: 'run-1' }),
    ).rejects.toBeInstanceOf(IndexingResourceLimitError);
    expect(queueService.enqueueParseJob).not.toHaveBeenCalled();
  });

  it('maps resource limit errors to UnrecoverableError in the job processor', () => {
    const wrapped = indexingResourceLimitService.toUnrecoverableError(
      new IndexingResourceLimitError(
        IndexingResourceMetric.EMBEDDING_CHUNKS,
        20000,
        15000,
        'too many chunks',
      ),
    );
    expect(wrapped).toBeInstanceOf(UnrecoverableError);
  });
});
