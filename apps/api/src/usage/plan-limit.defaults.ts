import { UsageMetric, UsagePeriod, type PrismaClient } from '@prisma/client';
import { upsertDefaultPlanIndexingLimits } from './plan-indexing-limit.defaults';

export const DEFAULT_PLAN_KEYS = ['free', 'pro', 'enterprise'] as const;
export type DefaultPlanKey = (typeof DEFAULT_PLAN_KEYS)[number];

export const DEFAULT_PLAN_LIMIT_ROWS: Array<{
  planKey: DefaultPlanKey;
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}> = [
  {
    planKey: 'free',
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: 1,
  },
  {
    planKey: 'free',
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: 5,
  },
  {
    planKey: 'free',
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: 3,
  },
  {
    planKey: 'free',
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: 50,
  },
  {
    planKey: 'free',
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: 3,
  },
  {
    planKey: 'pro',
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    planKey: 'pro',
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'pro',
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'pro',
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'pro',
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    planKey: 'enterprise',
    metric: UsageMetric.REPOSITORIES,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
  {
    planKey: 'enterprise',
    metric: UsageMetric.INDEXING_RUNS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'enterprise',
    metric: UsageMetric.GUIDE_GENERATIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'enterprise',
    metric: UsageMetric.AI_QUESTIONS,
    period: UsagePeriod.MONTHLY,
    maxValue: null,
  },
  {
    planKey: 'enterprise',
    metric: UsageMetric.MEMBERS,
    period: UsagePeriod.CURRENT,
    maxValue: null,
  },
];

export const DEFAULT_PLAN_METADATA: Record<
  DefaultPlanKey,
  {
    name: string;
    description: string;
    isContactSales: boolean;
    sortOrder: number;
  }
> = {
  free: {
    name: 'Free',
    description:
      'Validate the workflow with hosted AI and plan-based usage limits.',
    isContactSales: false,
    sortOrder: 0,
  },
  pro: {
    name: 'PRO',
    description:
      'Unlock higher usage limits with hosted AI or your own model key.',
    isContactSales: false,
    sortOrder: 1,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Custom limits, governance, and support. Contact sales.',
    isContactSales: true,
    sortOrder: 2,
  },
};

/**
 * Ensures the three default plans (free/pro/enterprise) exist, in case this
 * runs against a database that hasn't applied the billing migration's
 * hand-written INSERT (e.g. a fresh `prisma migrate deploy` still runs it,
 * but this keeps `prisma db push`-based setups and tests working too).
 */
export async function upsertDefaultPlans(
  prisma: Pick<PrismaClient, 'plan'>,
): Promise<Record<DefaultPlanKey, string>> {
  const ids: Partial<Record<DefaultPlanKey, string>> = {};
  for (const key of DEFAULT_PLAN_KEYS) {
    const metadata = DEFAULT_PLAN_METADATA[key];
    const plan = await prisma.plan.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: metadata.name,
        description: metadata.description,
        isContactSales: metadata.isContactSales,
        sortOrder: metadata.sortOrder,
      },
    });
    ids[key] = plan.id;
  }
  return ids as Record<DefaultPlanKey, string>;
}

export async function upsertDefaultPlanLimits(
  prisma: Pick<PrismaClient, 'planLimit' | 'planIndexingLimit' | 'plan'>,
): Promise<Record<DefaultPlanKey, string>> {
  const planIds = await upsertDefaultPlans(prisma);
  for (const row of DEFAULT_PLAN_LIMIT_ROWS) {
    const planId = planIds[row.planKey];
    await prisma.planLimit.upsert({
      where: {
        planId_metric: {
          planId,
          metric: row.metric,
        },
      },
      update: {
        period: row.period,
        maxValue: row.maxValue,
      },
      create: {
        planId,
        metric: row.metric,
        period: row.period,
        maxValue: row.maxValue,
      },
    });
  }
  await upsertDefaultPlanIndexingLimits(prisma);
  return planIds;
}
