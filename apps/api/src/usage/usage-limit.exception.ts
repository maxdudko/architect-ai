import { ForbiddenException } from '@nestjs/common';
import { UsageMetric, UsagePeriod } from '@prisma/client';

export const USAGE_LIMIT_EXCEEDED_CODE = 'USAGE_LIMIT_EXCEEDED';

const METRIC_LABELS: Record<UsageMetric, string> = {
  REPOSITORIES: 'repository connections',
  INDEXING_RUNS: 'repository indexing',
  GUIDE_GENERATIONS: 'onboarding guide generations',
  AI_QUESTIONS: 'AI questions',
  MEMBERS: 'workspace members',
};

export interface UsageLimitExceededBody {
  code: typeof USAGE_LIMIT_EXCEEDED_CODE;
  message: string;
  metric: UsageMetric;
  used: number;
  limit: number;
  period: UsagePeriod;
}

export class UsageLimitExceededException extends ForbiddenException {
  constructor(params: {
    metric: UsageMetric;
    used: number;
    limit: number;
    period: UsagePeriod;
  }) {
    const body: UsageLimitExceededBody = {
      code: USAGE_LIMIT_EXCEEDED_CODE,
      message: `Workspace has reached its ${METRIC_LABELS[params.metric]} limit`,
      metric: params.metric,
      used: params.used,
      limit: params.limit,
      period: params.period,
    };
    super(body);
  }
}
