import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryStatus } from '@prisma/client';
import Redis from 'ioredis';
import { RepositoriesRepository } from './repositories.repository';

interface IndexRepositoryJobData {
  workspaceId: string;
  repositoryId: string;
}

@Injectable()
export class RepositoryIndexingQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RepositoryIndexingQueueService.name);
  private readonly queueName = 'repository:indexing:jobs';
  private redisPublisher: Redis | null = null;
  private redisConsumer: Redis | null = null;
  private consumeLoopActive = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not set, indexing queue will run in process',
      );
      return;
    }

    this.redisPublisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
    });
    this.redisConsumer = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.consumeLoopActive = true;
    void this.consumeLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.consumeLoopActive = false;
    await this.redisConsumer?.quit();
    await this.redisPublisher?.quit();
  }

  async enqueueIndexing(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    if (this.redisPublisher) {
      const payload: IndexRepositoryJobData = {
        workspaceId,
        repositoryId,
      };
      await this.redisPublisher.lpush(this.queueName, JSON.stringify(payload));
      return;
    }

    setTimeout(() => {
      void this.runPipeline(workspaceId, repositoryId);
    }, 0);
  }

  private async runPipeline(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    try {
      await this.repositoriesRepository.updateStatus(
        workspaceId,
        repositoryId,
        {
          status: RepositoryStatus.CLONING,
          indexingError: null,
          lastIndexedAt: null,
        },
      );
      await this.delay(150);

      await this.repositoriesRepository.updateStatus(
        workspaceId,
        repositoryId,
        {
          status: RepositoryStatus.PARSING,
          indexingError: null,
          lastIndexedAt: null,
        },
      );
      await this.delay(150);

      await this.repositoriesRepository.updateStatus(
        workspaceId,
        repositoryId,
        {
          status: RepositoryStatus.EMBEDDING,
          indexingError: null,
          lastIndexedAt: null,
        },
      );
      await this.delay(150);

      await this.repositoriesRepository.updateStatus(
        workspaceId,
        repositoryId,
        {
          status: RepositoryStatus.READY,
          indexingError: null,
          lastIndexedAt: new Date(),
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown indexing failure';
      await this.repositoriesRepository.updateStatus(
        workspaceId,
        repositoryId,
        {
          status: RepositoryStatus.FAILED,
          indexingError: message,
        },
      );
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async consumeLoop(): Promise<void> {
    if (!this.redisConsumer) {
      return;
    }

    while (this.consumeLoopActive) {
      try {
        const result = await this.redisConsumer.brpop(this.queueName, 1);
        if (!result || result.length < 2) {
          continue;
        }

        const data = JSON.parse(result[1]) as IndexRepositoryJobData;
        if (!data.workspaceId || !data.repositoryId) {
          this.logger.warn('Skipping malformed indexing job payload');
          continue;
        }

        await this.runPipeline(data.workspaceId, data.repositoryId);
      } catch (error) {
        this.logger.error(`Indexing consumer loop error: ${String(error)}`);
      }
    }
  }
}
