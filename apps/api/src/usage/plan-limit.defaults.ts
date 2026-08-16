import {
  UsageMetric,
  UsagePeriod,
  WorkspacePlan,
  type PrismaClient,
} from '@prisma/client';

export const DEFAULT_PLAN_LIMIT_ROWS: Array<{
  plan: WorkspacePlan;
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}> = [
  {
    plan: WorkspacePlan.FREE,
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: 1,
  },
  {
    plan: WorkspacePlan.FREE,
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: 5,
  },
  {
    plan: WorkspacePlan.FREE,
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: 3,
  },
  {
    plan: WorkspacePlan.FREE,
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: 50,
  },
  {
    plan: WorkspacePlan.FREE,
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: 3,
  },
  {
    plan: WorkspacePlan.PRO,
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.PRO,
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.PRO,
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.PRO,
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.PRO,
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.ENTERPRISE,
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.ENTERPRISE,
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.ENTERPRISE,
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.ENTERPRISE,
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    plan: WorkspacePlan.ENTERPRISE,
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
];

export async function upsertDefaultPlanLimits(
  prisma: Pick<PrismaClient, 'planLimit'>,
): Promise<void> {
  for (const row of DEFAULT_PLAN_LIMIT_ROWS) {
    await prisma.planLimit.upsert({
      where: {
        plan_metric: {
          plan: row.plan,
          metric: row.metric,
        },
      },
      update: {
        period: row.period,
        maxValue: row.maxValue,
      },
      create: row,
    });
  }
}
