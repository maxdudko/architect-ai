import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
} from '@prisma/client';
import { Queue } from 'bullmq';
import type { OnboardingGuideStorage } from '../interfaces/onboarding-guide-storage.interface';
import { ONBOARDING_GUIDE_STORAGE } from '../interfaces/tokens';
import type { OnboardingGuideGenerationRun } from '../types/guide-generation-run.type';
import {
  getDefaultOnboardingGuideJobOptions,
  getOnboardingGuideQueueName,
  getOnboardingGuideRedisConnection,
} from './onboarding-guide-queue.config';
import {
  ManualGuideGenerationRequest,
  ONBOARDING_GUIDE_JOB_NAME,
  OnboardingGuideJobData,
  PostIndexGuideGenerationRequest,
} from './onboarding-guide-queue.types';

@Injectable()
export class OnboardingGuideQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OnboardingGuideQueueService.name);
  private readonly queueName = getOnboardingGuideQueueName();
  private readonly jobOptions = getDefaultOnboardingGuideJobOptions();
  private queue: Queue<OnboardingGuideJobData> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(ONBOARDING_GUIDE_STORAGE)
    private readonly storage: OnboardingGuideStorage,
  ) {}

  onModuleInit(): void {
    if (!this.configService.get<string>('REDIS_URL')) {
      this.logger.warn(
        'Onboarding guide queue disabled: REDIS_URL is not configured',
      );
      return;
    }
    try {
      this.queue = new Queue<OnboardingGuideJobData>(this.queueName, {
        ...getOnboardingGuideRedisConnection(this.configService),
        defaultJobOptions: this.jobOptions,
      });
      this.queue.on('error', (error) => {
        this.logger.error(`Onboarding guide queue error: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(
        `Failed to initialize onboarding guide queue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  enqueueManualGenerate(
    request: ManualGuideGenerationRequest,
  ): Promise<OnboardingGuideGenerationRun> {
    return this.enqueue(
      request,
      GuideGenerationTrigger.MANUAL_GENERATE,
      null,
      null,
    );
  }

  enqueueManualRegenerate(
    request: ManualGuideGenerationRequest,
  ): Promise<OnboardingGuideGenerationRun> {
    return this.enqueue(
      request,
      GuideGenerationTrigger.MANUAL_REGENERATE,
      null,
      null,
    );
  }

  enqueuePostIndexGeneration(
    request: PostIndexGuideGenerationRequest,
  ): Promise<OnboardingGuideGenerationRun> {
    return this.enqueue(
      request,
      request.trigger,
      request.sourceIndexingRunId,
      request.sourceCommitSha ?? null,
    );
  }

  async waitUntilReady(): Promise<void> {
    await this.requireAvailableQueue();
  }

  private async enqueue(
    request: ManualGuideGenerationRequest,
    trigger: GuideGenerationTrigger,
    sourceIndexingRunId: string | null,
    sourceCommitSha: string | null,
  ): Promise<OnboardingGuideGenerationRun> {
    await this.storage.validateRepositoryReady(
      request.workspaceId,
      request.repositoryId,
    );
    const active = await this.storage.findActiveGenerationRun(
      request.workspaceId,
      request.repositoryId,
    );
    if (active) {
      return active;
    }

    const queue = await this.requireAvailableQueue();
    const run = await this.storage.createGenerationRun({
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      trigger,
      requestedTypes: this.resolveTypes(request.requestedTypes),
      sourceIndexingRunId,
      sourceCommitSha,
    });

    try {
      await queue.add(
        ONBOARDING_GUIDE_JOB_NAME,
        {
          runId: run.id,
          workspaceId: run.workspaceId,
          repositoryId: run.repositoryId,
        },
        {
          ...this.jobOptions,
          jobId: `guide-generation__${run.id}`,
        },
      );
      return run;
    } catch (error) {
      const message = `Onboarding guide queue is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`;
      try {
        await this.storage.updateGenerationRun(
          run.workspaceId,
          run.repositoryId,
          run.id,
          {
            status: GuideGenerationStatus.FAILED,
            error: message,
            errors: [message],
            completedAt: new Date(),
          },
        );
      } catch (updateError) {
        this.logger.error(
          `Could not mark unqueued guide generation run ${run.id} as failed: ${
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
          }`,
        );
      }
      throw new Error(message, { cause: error });
    }
  }

  private resolveTypes(requestedTypes?: GuideType[]): GuideType[] {
    const types = requestedTypes ?? Object.values(GuideType);
    const resolved = [...new Set(types)];
    if (resolved.length === 0) {
      throw new Error('At least one onboarding guide type must be requested');
    }
    const valid = new Set(Object.values(GuideType));
    for (const type of resolved) {
      if (!valid.has(type)) {
        throw new Error(`Unsupported onboarding guide type: ${String(type)}`);
      }
    }
    return resolved;
  }

  private async requireAvailableQueue(): Promise<
    Queue<OnboardingGuideJobData>
  > {
    if (!this.queue) {
      throw new Error(
        'Onboarding guide queue is unavailable; configure REDIS_URL',
      );
    }
    const timeoutMs = Number(
      this.configService.get<string>('ONBOARDING_QUEUE_READY_TIMEOUT_MS') ??
        5_000,
    );
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.queue.waitUntilReady(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(`Redis readiness timed out after ${timeoutMs}ms`),
              ),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      throw new Error(
        `Onboarding guide queue is unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    return this.queue;
  }
}
