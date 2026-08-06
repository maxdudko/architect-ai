import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, QueueEvents, Worker } from 'bullmq';
import { captureError } from '../../../common/observability/error-tracker';
import { OnboardingGuideOrchestrator } from '../onboarding-guide.orchestrator';
import {
  getOnboardingGuideQueueName,
  getOnboardingGuideRedisConnection,
} from './onboarding-guide-queue.config';
import {
  ONBOARDING_GUIDE_JOB_NAME,
  OnboardingGuideJobData,
} from './onboarding-guide-queue.types';
import { OnboardingGuideQueueService } from './onboarding-guide-queue.service';

@Injectable()
export class OnboardingGuideWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OnboardingGuideWorkerService.name);
  private readonly workerEnabled: boolean;
  private worker: Worker<OnboardingGuideJobData> | null = null;
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: OnboardingGuideQueueService,
    private readonly orchestrator: OnboardingGuideOrchestrator,
  ) {
    this.workerEnabled =
      (this.configService.get<string>('ONBOARDING_WORKER_ENABLED') ??
        this.configService.get<string>('INDEXING_WORKER_ENABLED') ??
        'false') === 'true';
  }

  async onModuleInit(): Promise<void> {
    if (!this.workerEnabled) {
      return;
    }
    await this.queueService.waitUntilReady();

    const queueName = getOnboardingGuideQueueName();
    const connection = getOnboardingGuideRedisConnection(this.configService);
    const concurrency = Number(
      this.configService.get<string>('ONBOARDING_WORKER_CONCURRENCY') ?? 1,
    );
    const lockDuration = Number(
      this.configService.get<string>('ONBOARDING_JOB_LOCK_DURATION_MS') ??
        30 * 60 * 1000,
    );
    this.worker = new Worker<OnboardingGuideJobData>(
      queueName,
      async (job) => {
        if (job.name !== ONBOARDING_GUIDE_JOB_NAME) {
          throw new Error(`Unknown onboarding guide job name: ${job.name}`);
        }
        await this.orchestrator.execute(job.data.runId);
      },
      {
        ...connection,
        concurrency: Math.max(1, concurrency),
        lockDuration,
        stalledInterval: Math.min(Math.floor(lockDuration / 2), 60_000),
      },
    );

    this.queueEvents = new QueueEvents(queueName, connection);
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(
        JSON.stringify({
          event: 'onboarding_job_failed_event',
          jobId,
          failedReason,
          service: 'onboarding-worker',
        }),
      );
    });
    this.worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade < maxAttempts) {
        this.logger.warn(
          JSON.stringify({
            event: 'onboarding_job_retry',
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            maxAttempts,
            error: error.message,
            service: 'onboarding-worker',
          }),
        );
        return;
      }
      void this.recordTerminalFailure(job, error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents?.close();
    await this.worker?.close();
    this.queueEvents = null;
    this.worker = null;
  }

  private async recordTerminalFailure(
    job: Job<OnboardingGuideJobData>,
    error: Error,
  ): Promise<void> {
    try {
      await this.orchestrator.recordTerminalFailure(job.data.runId, error);
    } catch (recordError) {
      captureError(recordError, {
        requestId: null,
        userId: null,
        organizationId: null,
        repositoryId: null,
        method: 'WORKER',
        route: 'onboarding',
      });
      this.logger.error(
        JSON.stringify({
          event: 'onboarding_terminal_failure_record_error',
          runId: job.data.runId,
          error:
            recordError instanceof Error
              ? recordError.message
              : String(recordError),
          service: 'onboarding-worker',
        }),
      );
    }
  }
}
