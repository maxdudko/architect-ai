import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, QueueEvents, UnrecoverableError, Worker } from 'bullmq';
import { captureError } from '../../../../common/observability/error-tracker';
import { SYSTEM_OVERVIEW_JOB_NAME } from '../system-overview.constants';
import { OverviewValidationError } from '../overview-validation.error';
import { SystemOverviewOrchestrator } from '../system-overview.orchestrator';
import {
  getSystemOverviewQueueName,
  getSystemOverviewRedisConnection,
  systemOverviewQueueDriver,
} from './system-overview-queue.config';
import { type SystemOverviewJobData } from './system-overview-queue.service';

@Injectable()
export class SystemOverviewWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SystemOverviewWorkerService.name);
  private readonly workerEnabled: boolean;
  private worker: Worker<SystemOverviewJobData> | null = null;
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly orchestrator: SystemOverviewOrchestrator,
  ) {
    const flag =
      (this.configService.get<string>('ONBOARDING_WORKER_ENABLED') ??
        this.configService.get<string>('INDEXING_WORKER_ENABLED') ??
        'false') === 'true';
    this.workerEnabled =
      flag && systemOverviewQueueDriver(configService) === 'redis';
  }

  onModuleInit(): void {
    if (!this.workerEnabled) {
      return;
    }

    const queueName = getSystemOverviewQueueName();
    const connection = getSystemOverviewRedisConnection(this.configService);
    const concurrency = Number(
      this.configService.get<string>('ONBOARDING_WORKER_CONCURRENCY') ?? 1,
    );
    const lockDuration = Number(
      this.configService.get<string>('ONBOARDING_JOB_LOCK_DURATION_MS') ??
        30 * 60 * 1000,
    );
    this.worker = new Worker<SystemOverviewJobData>(
      queueName,
      async (job) => {
        if (job.name !== SYSTEM_OVERVIEW_JOB_NAME) {
          throw new Error(
            `Unknown architecture overview job name: ${job.name}`,
          );
        }
        try {
          await this.orchestrator.execute(job.data.runId);
        } catch (error) {
          if (error instanceof OverviewValidationError) {
            throw new UnrecoverableError(error.publicMessage);
          }
          throw error;
        }
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
          event: 'architecture_overview_job_failed_event',
          jobId,
          failedReason,
          service: 'architecture-overview-worker',
        }),
      );
    });
    this.worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      if (error instanceof UnrecoverableError) {
        return;
      }
      if (job.attemptsMade < maxAttempts) {
        this.logger.warn(
          JSON.stringify({
            event: 'architecture_overview_job_retry',
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            maxAttempts,
            error: error.message,
            service: 'architecture-overview-worker',
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
    job: Job<SystemOverviewJobData>,
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
        route: 'architecture-overview',
      });
      this.logger.error(
        JSON.stringify({
          event: 'architecture_overview_terminal_failure_record_error',
          runId: job.data.runId,
          error:
            recordError instanceof Error
              ? recordError.message
              : String(recordError),
          service: 'architecture-overview-worker',
        }),
      );
    }
  }
}
