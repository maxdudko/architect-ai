import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsEventType, RepositoryStatus, UsageMetric } from '@prisma/client';
import { QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { AnalyticsService } from '../../analytics/analytics.service';
import { captureError } from '../../common/observability/error-tracker';
import { OnboardingGuideQueueService } from '../../modules/onboarding/queue/onboarding-guide-queue.service';
import { UsageService } from '../../usage/usage.service';
import { RepositoriesRepository } from '../repositories.repository';
import { RepositoryIndexingQueueService } from '../repository-indexing.queue.service';
import {
  CloneJobData,
  EmbedJobData,
  INDEXING_JOB_NAMES,
  IndexingJobName,
  ReindexJobData,
} from './indexing-job.types';
import {
  getQueueName,
  getRedisConnectionFromConfig,
} from './indexing-queue.config';
import { IndexingStorageService } from './indexing-storage.service';
import { RepositoryChunkService } from './repository-chunk.service';
import { RepositoryCloneService } from './repository-clone.service';
import { RepositoryEmbeddingService } from './repository-embedding.service';
import { RepositoryParseService } from './repository-parse.service';

@Injectable()
export class RepositoryIndexingWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RepositoryIndexingWorkerService.name);
  private worker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private readonly workerEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly queueService: RepositoryIndexingQueueService,
    private readonly cloneService: RepositoryCloneService,
    private readonly parseService: RepositoryParseService,
    private readonly chunkService: RepositoryChunkService,
    private readonly embeddingService: RepositoryEmbeddingService,
    private readonly indexingStorageService: IndexingStorageService,
    private readonly onboardingGuideQueue: OnboardingGuideQueueService,
    private readonly analyticsService: AnalyticsService,
    private readonly usageService: UsageService,
  ) {
    this.workerEnabled =
      (this.configService.get<string>('INDEXING_WORKER_ENABLED') ?? 'false') ===
      'true';
  }

  async onModuleInit(): Promise<void> {
    if (!this.workerEnabled) {
      return;
    }

    await this.indexingStorageService.cleanupStaleDirectories();
    await this.queueService.waitUntilReady();

    const queueName = getQueueName();
    const redisConnection = getRedisConnectionFromConfig(this.configService);
    const concurrency = Number(
      this.configService.get<string>('INDEXING_WORKER_CONCURRENCY') ?? 2,
    );
    const cloneTimeoutMs = Number(
      this.configService.get<string>('INDEXING_CLONE_TIMEOUT_MS') ?? 120_000,
    );
    // Keep the lock longer than the slowest stage (clone/parse) so BullMQ does
    // not stall-retry mid-job and wipe an in-progress clone directory.
    const lockDuration = Number(
      this.configService.get<string>('INDEXING_JOB_LOCK_DURATION_MS') ??
        Math.max(cloneTimeoutMs * 2, 30 * 60 * 1000),
    );

    this.worker = new Worker(
      queueName,
      async (job) => {
        switch (job.name as IndexingJobName) {
          case INDEXING_JOB_NAMES.reindex:
            await this.processReindex(job.data as ReindexJobData);
            return;
          case INDEXING_JOB_NAMES.clone:
            await this.processClone(job.data as CloneJobData);
            return;
          case INDEXING_JOB_NAMES.parse:
            await this.processParse(
              job.data as CloneJobData & { clonePath: string },
            );
            return;
          case INDEXING_JOB_NAMES.chunk:
            await this.processChunk(
              job.data as CloneJobData & { clonePath: string },
            );
            return;
          case INDEXING_JOB_NAMES.embed:
            await this.processEmbed(job.data as EmbedJobData);
            return;
          default:
            throw new Error(`Unknown job name: ${job.name}`);
        }
      },
      {
        ...redisConnection,
        concurrency,
        lockDuration,
        stalledInterval: Math.min(Math.floor(lockDuration / 2), 60_000),
      },
    );

    this.queueEvents = new QueueEvents(queueName, redisConnection);
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(
        JSON.stringify({
          event: 'indexing_job_failed_event',
          jobId,
          failedReason,
          service: 'indexing-worker',
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
            event: 'indexing_job_retry',
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            maxAttempts,
            workspaceId: (job.data as { workspaceId?: string }).workspaceId,
            repositoryId: (job.data as { repositoryId?: string }).repositoryId,
            error: error.message,
            service: 'indexing-worker',
          }),
        );
        return;
      }
      void this.handleWorkerFailure(job, error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents?.close();
    await this.worker?.close();
    this.queueEvents = null;
    this.worker = null;
  }

  private async handleWorkerFailure(
    job: { data: unknown } | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }
    const data = job.data as Partial<ReindexJobData & { runId: string }>;
    if (!data.workspaceId || !data.repositoryId) {
      return;
    }
    if (data.runId) {
      const failedAt = new Date();
      const existingRun = await this.repositoriesRepository.getIndexingRunById(
        data.runId,
      );
      await this.repositoriesRepository.updateIndexingRun(data.runId, {
        status: 'FAILED',
        error: error.message,
        errors: [error.message],
        completedAt: failedAt,
        processingDurationMs: existingRun
          ? Math.max(0, failedAt.getTime() - existingRun.startedAt.getTime())
          : undefined,
      });
      await this.indexingStorageService.cleanupRunDirectory(data.runId);
    }
    await this.queueService.markAsFailed({
      workspaceId: data.workspaceId,
      repositoryId: data.repositoryId,
      errorMessage: error.message,
    });
    if (data.trigger === 'INITIAL_CONNECT') {
      await this.analyticsService.recordEvent({
        type: AnalyticsEventType.REPOSITORY_INDEXING_FAILED,
        workspaceId: data.workspaceId,
        actorUserId: data.userId ?? null,
        repositoryId: data.repositoryId,
        payload: {
          trigger: data.trigger,
          runId: data.runId ?? null,
          error: error.message,
        },
      });
    }
    captureError(error, {
      requestId: null,
      userId: null,
      organizationId: data.workspaceId,
      repositoryId: data.repositoryId,
      method: 'WORKER',
      route: 'indexing',
    });
  }

  private async processReindex(data: ReindexJobData): Promise<void> {
    const run = await this.repositoriesRepository.createIndexingRun({
      repositoryId: data.repositoryId,
      trigger: data.trigger,
      status: 'RUNNING',
      branch: data.branch ?? null,
    });

    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      {
        status: RepositoryStatus.CLONING,
        indexingError: null,
        lastIndexedAt: null,
      },
    );

    await this.repositoriesRepository.deleteArtifactsForRepository(
      data.repositoryId,
    );
    await this.embeddingService.deleteRepositoryVectors(data.repositoryId);

    await this.queueService.enqueueCloneJob({
      ...data,
      runId: run.id,
      branch: data.branch ?? undefined,
    });
  }

  private async processClone(data: CloneJobData): Promise<void> {
    const result = await this.cloneService.cloneRepository(data);
    await this.repositoriesRepository.updateIndexingRun(data.runId, {
      branch: result.branch,
      commitSha: result.commitSha,
      clonePath: result.clonePath,
    });
    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      {
        status: RepositoryStatus.PARSING,
        indexingError: null,
        lastIndexedAt: null,
      },
    );
    await this.queueService.enqueueParseJob({
      ...data,
      branch: result.branch,
      clonePath: result.clonePath,
    });
  }

  private async processParse(
    data: CloneJobData & { clonePath: string },
  ): Promise<void> {
    try {
      await access(data.clonePath);
    } catch {
      throw new Error(
        `Clone directory is missing at ${data.clonePath}. The clone may have been cleaned up before parsing; retry indexing.`,
      );
    }

    const parseResult = await this.parseService.parseRepository({
      workspaceId: data.workspaceId,
      repositoryId: data.repositoryId,
      runId: data.runId,
      clonePath: data.clonePath,
    });

    await this.repositoriesRepository.updateIndexingRun(data.runId, {
      supportedFileCount: parseResult.supportedFileCount,
      ignoredFileCount: parseResult.ignoredFileCount,
      symbolCount: parseResult.symbolCount,
    });
    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      {
        status: RepositoryStatus.CHUNKING,
        indexingError: null,
        lastIndexedAt: null,
      },
    );
    await this.queueService.enqueueChunkJob(data);
  }

  private async processChunk(
    data: CloneJobData & { clonePath: string },
  ): Promise<void> {
    const chunkResult = await this.chunkService.chunkRepository({
      repositoryId: data.repositoryId,
      runId: data.runId,
      clonePath: data.clonePath,
    });
    await this.repositoriesRepository.updateIndexingRun(data.runId, {
      chunkCount: chunkResult.chunkCount,
    });
    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      {
        status: RepositoryStatus.EMBEDDING,
        indexingError: null,
        lastIndexedAt: null,
      },
    );
    await this.queueService.enqueueEmbedJob(data);
  }

  private async processEmbed(data: EmbedJobData): Promise<void> {
    const run = await this.repositoriesRepository.getIndexingRunById(
      data.runId,
    );
    if (!run) {
      throw new Error('Indexing run not found');
    }
    const branch = data.branch ?? run.branch ?? 'main';
    const commitSha = run.commitSha ?? randomUUID();
    const embedResult = await this.embeddingService.embedRepository({
      workspaceId: data.workspaceId,
      repositoryId: data.repositoryId,
      runId: data.runId,
      branch,
      commitSha,
    });
    const completedAt = new Date();
    await this.repositoriesRepository.updateIndexingRun(data.runId, {
      status: 'SUCCEEDED',
      completedAt,
      embeddingCount: embedResult.embeddedCount,
      processingDurationMs: Math.max(
        0,
        completedAt.getTime() - run.startedAt.getTime(),
      ),
    });
    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      {
        status: RepositoryStatus.READY,
        indexingError: null,
        lastIndexedAt: new Date(),
      },
    );
    if (data.trigger === 'INITIAL_CONNECT') {
      await this.analyticsService.recordEvent({
        type: AnalyticsEventType.REPOSITORY_INDEXING_SUCCEEDED,
        workspaceId: data.workspaceId,
        actorUserId: data.userId,
        repositoryId: data.repositoryId,
        payload: {
          trigger: data.trigger,
          runId: data.runId,
          embeddingCount: embedResult.embeddedCount,
        },
      });
    }
    await this.indexingStorageService.cleanupRunDirectory(data.runId);
    try {
      const canGenerateGuides = await this.usageService.hasRemaining(
        data.workspaceId,
        UsageMetric.GUIDE_GENERATIONS,
      );
      if (!canGenerateGuides) {
        this.logger.warn(
          JSON.stringify({
            event: 'indexing_onboarding_skipped_usage_limit',
            runId: data.runId,
            workspaceId: data.workspaceId,
            repositoryId: data.repositoryId,
            service: 'indexing-worker',
          }),
        );
        return;
      }
      await this.onboardingGuideQueue.enqueuePostIndexGeneration({
        workspaceId: data.workspaceId,
        repositoryId: data.repositoryId,
        trigger:
          data.trigger === 'INITIAL_CONNECT' ? 'INITIAL_INDEX' : 'REINDEX',
        sourceIndexingRunId: data.runId,
        sourceCommitSha: commitSha,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'indexing_onboarding_enqueue_failed',
          runId: data.runId,
          workspaceId: data.workspaceId,
          repositoryId: data.repositoryId,
          error: error instanceof Error ? error.message : String(error),
          service: 'indexing-worker',
        }),
      );
    }
  }
}
