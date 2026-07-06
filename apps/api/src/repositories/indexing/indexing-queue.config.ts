import { ConfigService } from '@nestjs/config';
import { JobsOptions } from 'bullmq';
import { REPOSITORY_INDEXING_QUEUE } from './indexing-job.types';

export function getRedisConnectionFromConfig(configService: ConfigService): {
  connection: { url: string };
} {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (!redisUrl) {
    throw new Error('REDIS_URL must be set for repository indexing queue');
  }
  return {
    connection: {
      url: redisUrl,
    },
  };
}

export function getDefaultIndexingJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: false,
  };
}

export function getQueueName(): string {
  return REPOSITORY_INDEXING_QUEUE;
}
