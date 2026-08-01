import { ConfigService } from '@nestjs/config';
import type { JobsOptions } from 'bullmq';
import { ONBOARDING_GUIDE_QUEUE } from './onboarding-guide-queue.types';

export function getOnboardingGuideRedisConnection(
  configService: ConfigService,
): { connection: { url: string } } {
  const redisUrl = configService.get<string>('REDIS_URL');
  if (!redisUrl) {
    throw new Error(
      'REDIS_URL must be set for onboarding guide generation queue',
    );
  }
  return { connection: { url: redisUrl } };
}

export function getDefaultOnboardingGuideJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2_000,
    },
    removeOnComplete: 1_000,
    removeOnFail: false,
  };
}

export function getOnboardingGuideQueueName(): string {
  return ONBOARDING_GUIDE_QUEUE;
}
