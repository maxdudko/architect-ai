import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_OPTIONS_KEY = 'rate_limit_options';
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_OPTIONS_KEY, options);

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
