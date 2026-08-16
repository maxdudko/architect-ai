import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';
import { Queue } from 'bullmq';
import type { OnboardingGuideStorage } from './interfaces/onboarding-guide-storage.interface';
import { RepositoryAccessValidationService } from '../../repositories/repository-access-validation.service';
import { UsageLimitExceededException } from '../../usage/usage-limit.exception';
import { OnboardingGuidesService } from './onboarding-guides.service';
import { OnboardingGuideQueueService } from './queue/onboarding-guide-queue.service';
import { ONBOARDING_GUIDE_JOB_NAME } from './queue/onboarding-guide-queue.types';
import type { OnboardingGuideGenerationRun } from './types/guide-generation-run.type';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    waitUntilReady: jest.fn(),
  })),
}));

describe('OnboardingGuidesService', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const run: OnboardingGuideGenerationRun = {
    id: 'run-1',
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    trigger: GuideGenerationTrigger.MANUAL_GENERATE,
    status: GuideGenerationStatus.QUEUED,
    requestedTypes: [GuideType.PROJECT_OVERVIEW],
    totalGuideCount: 0,
    completedGuideCount: 0,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    error: null,
    errors: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };

  let storage: jest.Mocked<OnboardingGuideStorage>;
  let queue: jest.Mocked<OnboardingGuideQueueService>;
  let repositoryAccessValidationService: jest.Mocked<RepositoryAccessValidationService>;
  let usageService: { assertWithinLimit: jest.Mock };
  let service: OnboardingGuidesService;

  beforeEach(() => {
    storage = {
      validateRepository: jest.fn(),
      validateRepositoryReady: jest.fn().mockResolvedValue(undefined),
      listGuides: jest.fn().mockResolvedValue([]),
      getGuide: jest.fn().mockResolvedValue(null),
      createGenerationRun: jest.fn(),
      getGenerationRun: jest.fn(),
      updateGenerationRun: jest.fn(),
      findActiveGenerationRun: jest.fn().mockResolvedValue(null),
      findLatestGenerationRun: jest.fn().mockResolvedValue(null),
      replaceGuideSet: jest.fn(),
      deleteGuide: jest.fn(),
      deleteGuides: jest.fn(),
    };
    queue = {
      waitUntilReady: jest.fn().mockResolvedValue(undefined),
      enqueueManualGenerate: jest.fn().mockResolvedValue(run),
      enqueueManualRegenerate: jest.fn().mockResolvedValue({
        ...run,
        trigger: GuideGenerationTrigger.MANUAL_REGENERATE,
      }),
    } as unknown as jest.Mocked<OnboardingGuideQueueService>;
    repositoryAccessValidationService = {
      assertUserCanAccessRepository: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RepositoryAccessValidationService>;
    usageService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    service = new OnboardingGuidesService(
      storage,
      queue,
      repositoryAccessValidationService,
      usageService as never,
    );
  });

  it('returns the active run without checking or adding to the queue', async () => {
    storage.findActiveGenerationRun.mockResolvedValue({
      ...run,
      status: GuideGenerationStatus.RUNNING,
    });

    const response = await service.generateGuides(
      run.workspaceId,
      run.repositoryId,
      'user-1',
      [GuideType.GLOSSARY],
    );

    expect(response.status).toBe(GuideGenerationStatus.RUNNING);
    expect(queue.waitUntilReady).not.toHaveBeenCalled();
    expect(queue.enqueueManualGenerate).not.toHaveBeenCalled();
  });

  it('does not enqueue generation when the guide limit is exceeded', async () => {
    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.GUIDE_GENERATIONS,
        used: 3,
        limit: 3,
        period: UsagePeriod.MONTHLY,
      }),
    );

    await expect(
      service.generateGuides(run.workspaceId, run.repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(queue.enqueueManualGenerate).not.toHaveBeenCalled();
  });

  it('queues generate and regenerate with distinct methods', async () => {
    const requested = [GuideType.MODULE, GuideType.GLOSSARY];

    const generated = await service.generateGuides(
      run.workspaceId,
      run.repositoryId,
      'user-1',
      requested,
    );
    const regenerated = await service.regenerateGuides(
      run.workspaceId,
      run.repositoryId,
      'user-1',
      requested,
    );

    expect(storage.validateRepositoryReady).toHaveBeenCalledTimes(2);
    expect(queue.waitUntilReady).toHaveBeenCalledTimes(2);
    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).toHaveBeenCalled();
    expect(queue.enqueueManualGenerate).toHaveBeenCalledWith({
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      requestedTypes: requested,
    });
    expect(queue.enqueueManualRegenerate).toHaveBeenCalledWith({
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      requestedTypes: requested,
    });
    expect(generated.trigger).toBe(GuideGenerationTrigger.MANUAL_GENERATE);
    expect(regenerated.trigger).toBe(GuideGenerationTrigger.MANUAL_REGENERATE);
  });

  it('maps readiness and queue failures to API exceptions', async () => {
    storage.validateRepositoryReady.mockRejectedValueOnce(
      new Error('Repository must be READY before generating'),
    );
    await expect(
      service.generateGuides(run.workspaceId, run.repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    storage.validateRepositoryReady.mockResolvedValue(undefined);
    queue.waitUntilReady.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(
      service.generateGuides(run.workspaceId, run.repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    queue.waitUntilReady.mockResolvedValue(undefined);
    queue.enqueueManualGenerate.mockRejectedValueOnce(
      new Error('At least one onboarding guide type must be requested'),
    );
    await expect(
      service.generateGuides(run.workspaceId, run.repositoryId, 'user-1', []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves workspace/repository scope for list and get', async () => {
    const guide = {
      id: 'guide-1',
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      type: GuideType.MODULE,
      slug: 'billing',
      title: 'Billing',
      markdown: '# Billing',
      summary: null,
      metadata: null,
      generationVersion: 2,
      sourceIndexingRunId: null,
      sourceCommitSha: null,
      createdAt: now,
      updatedAt: now,
    };
    storage.listGuides.mockResolvedValue([guide]);
    storage.getGuide.mockResolvedValue(guide);

    const listed = await service.listGuides(
      run.workspaceId,
      run.repositoryId,
      'user-1',
      GuideType.MODULE,
      ' billing ',
    );
    const fetched = await service.getGuide(
      run.workspaceId,
      run.repositoryId,
      guide.id,
      'user-1',
    );

    expect(storage.listGuides).toHaveBeenCalledWith(
      run.workspaceId,
      run.repositoryId,
      { types: [GuideType.MODULE], search: 'billing' },
    );
    expect(storage.getGuide).toHaveBeenCalledWith(
      run.workspaceId,
      run.repositoryId,
      guide.id,
    );
    expect(listed.total).toBe(1);
    expect(fetched.generationVersion).toBe(2);
    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).not.toHaveBeenCalled();

    storage.getGuide.mockResolvedValue(null);
    await expect(
      service.getGuide('other-workspace', run.repositoryId, guide.id, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OnboardingGuideQueueService', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const run: OnboardingGuideGenerationRun = {
    id: 'run-queue-1',
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    trigger: GuideGenerationTrigger.MANUAL_GENERATE,
    status: GuideGenerationStatus.QUEUED,
    requestedTypes: [GuideType.PROJECT_OVERVIEW],
    totalGuideCount: 0,
    completedGuideCount: 0,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    error: null,
    errors: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };

  let storage: jest.Mocked<OnboardingGuideStorage>;
  let service: OnboardingGuideQueueService;
  let queueInstance: {
    add: jest.Mock;
    close: jest.Mock;
    on: jest.Mock;
    waitUntilReady: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage = {
      validateRepository: jest.fn(),
      validateRepositoryReady: jest.fn().mockResolvedValue(undefined),
      listGuides: jest.fn(),
      getGuide: jest.fn(),
      createGenerationRun: jest.fn().mockResolvedValue(run),
      getGenerationRun: jest.fn(),
      updateGenerationRun: jest.fn(),
      findActiveGenerationRun: jest.fn().mockResolvedValue(null),
      findLatestGenerationRun: jest.fn(),
      replaceGuideSet: jest.fn(),
      deleteGuide: jest.fn(),
      deleteGuides: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined,
      ),
    } as unknown as ConfigService;
    service = new OnboardingGuideQueueService(config, storage);
    service.onModuleInit();
    queueInstance = (Queue as unknown as jest.Mock).mock.results.at(-1)!.value;
    queueInstance.waitUntilReady.mockResolvedValue(undefined);
  });

  it('deduplicates requested types and enqueues a scoped manual job', async () => {
    await service.enqueueManualGenerate({
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      requestedTypes: [
        GuideType.PROJECT_OVERVIEW,
        GuideType.PROJECT_OVERVIEW,
        GuideType.GLOSSARY,
      ],
    });

    expect(storage.createGenerationRun).toHaveBeenCalledWith({
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      trigger: GuideGenerationTrigger.MANUAL_GENERATE,
      requestedTypes: [GuideType.PROJECT_OVERVIEW, GuideType.GLOSSARY],
      sourceIndexingRunId: null,
      sourceCommitSha: null,
    });
    expect(queueInstance.add).toHaveBeenCalledWith(
      ONBOARDING_GUIDE_JOB_NAME,
      {
        runId: run.id,
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
      },
      expect.objectContaining({ jobId: `guide-generation__${run.id}` }),
    );
  });

  it('returns an existing active run without creating a duplicate', async () => {
    storage.findActiveGenerationRun.mockResolvedValue(run);

    await expect(
      service.enqueueManualRegenerate({
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
      }),
    ).resolves.toBe(run);

    expect(storage.createGenerationRun).not.toHaveBeenCalled();
    expect(queueInstance.add).not.toHaveBeenCalled();
  });

  it('marks the run failed if queue insertion fails', async () => {
    queueInstance.add.mockRejectedValue(new Error('connection lost'));

    await expect(
      service.enqueueManualGenerate({
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
      }),
    ).rejects.toThrow('queue is unavailable');

    expect(storage.updateGenerationRun).toHaveBeenCalledWith(
      run.workspaceId,
      run.repositoryId,
      run.id,
      expect.objectContaining({
        status: GuideGenerationStatus.FAILED,
        error: expect.stringContaining('connection lost'),
        completedAt: expect.any(Date),
      }),
    );
  });

  it('rejects empty requested types before creating a run', async () => {
    await expect(
      service.enqueueManualGenerate({
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
        requestedTypes: [],
      }),
    ).rejects.toThrow('At least one onboarding guide type');
    expect(storage.createGenerationRun).not.toHaveBeenCalled();
  });
});
