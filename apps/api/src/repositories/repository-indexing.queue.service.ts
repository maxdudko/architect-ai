import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryStatus } from '@prisma/client';
import { JobsOptions, Queue } from 'bullmq';
import { RepositoriesRepository } from './repositories.repository';
import {
  CloneJobData,
  INDEXING_JOB_NAMES,
  ReindexJobData,
} from './indexing/indexing-job.types';
import {
  getDefaultIndexingJobOptions,
  getQueueName,
  getRedisConnectionFromConfig,
} from './indexing/indexing-queue.config';

@Injectable()
export class RepositoryIndexingQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RepositoryIndexingQueueService.name);
  private queue: Queue | null = null;
  private readonly queueName = getQueueName();
  private readonly defaultJobOptions = getDefaultIndexingJobOptions();

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  onModuleInit(): void {
    if (!this.configService.get<string>('REDIS_URL')) {
      this.logger.warn(
        'Repository indexing queue disabled: REDIS_URL is not configured',
      );
      return;
    }

    try {
      this.queue = new Queue(this.queueName, {
        ...getRedisConnectionFromConfig(this.configService),
        defaultJobOptions: this.defaultJobOptions,
      });
    } catch (error) {
      this.logger.error(
        `Failed to initialize BullMQ queue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }

  async enqueueInitialIndexing(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch?: string;
  }): Promise<void> {
    await this.enqueueReindex({
      ...params,
      trigger: 'INITIAL_CONNECT',
    });
  }

  async enqueueRetryIndexing(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch?: string;
  }): Promise<void> {
    await this.enqueueReindex({
      ...params,
      trigger: 'MANUAL_RETRY',
    });
  }

  async enqueueManualReindex(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch?: string;
  }): Promise<void> {
    await this.enqueueReindex({
      ...params,
      trigger: 'MANUAL_REINDEX',
    });
  }

  async enqueueReindex(data: ReindexJobData): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }

    await this.queue.add(INDEXING_JOB_NAMES.reindex, data, {
      ...this.defaultJobOptions,
      jobId: this.buildJobId(
        data.workspaceId,
        data.repositoryId,
        data.trigger,
        data.branch ?? 'default',
        String(Date.now()),
      ),
    });
  }

  async enqueueCloneJob(
    data: CloneJobData,
    options?: JobsOptions,
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }

    await this.queue.add(INDEXING_JOB_NAMES.clone, data, {
      ...this.defaultJobOptions,
      ...options,
      jobId: this.buildJobId(data.runId, 'clone'),
    });
  }

  async enqueueParseJob(
    data: CloneJobData & { clonePath: string },
    options?: JobsOptions,
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }

    await this.queue.add(INDEXING_JOB_NAMES.parse, data, {
      ...this.defaultJobOptions,
      ...options,
      jobId: this.buildJobId(data.runId, 'parse'),
    });
  }

  async enqueueChunkJob(
    data: CloneJobData & { clonePath: string },
    options?: JobsOptions,
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }

    await this.queue.add(INDEXING_JOB_NAMES.chunk, data, {
      ...this.defaultJobOptions,
      ...options,
      jobId: this.buildJobId(data.runId, 'chunk'),
    });
  }

  async enqueueEmbedJob(
    data: CloneJobData & { clonePath: string },
    options?: JobsOptions,
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }

    await this.queue.add(INDEXING_JOB_NAMES.embed, data, {
      ...this.defaultJobOptions,
      ...options,
      jobId: this.buildJobId(data.runId, 'embed'),
    });
  }

  async markAsFailed(data: {
    workspaceId: string;
    repositoryId: string;
    errorMessage: string;
  }): Promise<void> {
    const previousSuccess =
      await this.repositoriesRepository.hasSucceededIndexingRun(
        data.repositoryId,
      );

    await this.repositoriesRepository.updateStatus(
      data.workspaceId,
      data.repositoryId,
      previousSuccess
        ? {
            status: RepositoryStatus.READY,
            indexingError: data.errorMessage,
          }
        : {
            status: RepositoryStatus.FAILED,
            indexingError: data.errorMessage,
          },
    );
  }

  isReady(): boolean {
    return this.queue !== null;
  }

  getQueue(): Queue | null {
    return this.queue;
  }

  getQueueJobOptions(): JobsOptions {
    return this.defaultJobOptions;
  }

  getQueueNameValue(): string {
    return this.queueName;
  }

  async waitUntilReady(): Promise<void> {
    if (!this.queue) {
      throw new Error('Repository indexing queue is unavailable');
    }
    await this.queue.waitUntilReady();
  }

  private buildJobId(...parts: string[]): string {
    return parts.map((part) => this.sanitizeJobIdPart(part)).join('__');
  }

  private sanitizeJobIdPart(value: string): string {
    return value.replace(/:/g, '_');
  }
}
