import { ConfigService } from '@nestjs/config';
import type { JobsOptions } from 'bullmq';
import { SYSTEM_OVERVIEW_QUEUE } from '../system-overview.constants';

export function getSystemOverviewRedisConnection(
  configService: ConfigService,
): {
  connection: { url: string };
} {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (!redisUrl) {
    throw new Error(
      'Architecture overview queue is unavailable: REDIS_URL must be set',
    );
  }
  return { connection: { url: redisUrl } };
}

export function getDefaultSystemOverviewJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: false,
  };
}

export function getSystemOverviewQueueName(): string {
  return SYSTEM_OVERVIEW_QUEUE;
}

export function systemOverviewQueueDriver(
  configService: ConfigService,
): 'redis' | 'memory' {
  return configService.get<string>('ARCHITECTURE_OVERVIEW_QUEUE_DRIVER') ===
    'memory'
    ? 'memory'
    : 'redis';
}
