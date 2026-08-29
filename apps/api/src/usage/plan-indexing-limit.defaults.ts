import { IndexingResourceMetric, type PrismaClient } from '@prisma/client';

export const DEFAULT_INDEXING_PLAN_KEYS = [
  'free',
  'pro',
  'enterprise',
] as const;
export type DefaultIndexingPlanKey =
  (typeof DEFAULT_INDEXING_PLAN_KEYS)[number];

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const INDEXING_RESOURCE_METRICS: IndexingResourceMetric[] = [
  IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
  IndexingResourceMetric.INDEXABLE_FILES,
  IndexingResourceMetric.INDEXED_TOKENS,
  IndexingResourceMetric.EMBEDDING_CHUNKS,
  IndexingResourceMetric.FILE_SIZE_BYTES,
];

export const DEFAULT_PLAN_INDEXING_LIMIT_ROWS: Array<{
  planKey: DefaultIndexingPlanKey;
  metric: IndexingResourceMetric;
  maxValue: bigint | null;
}> = [
  {
    planKey: 'free',
    metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
    maxValue: BigInt(250 * MB),
  },
  {
    planKey: 'free',
    metric: IndexingResourceMetric.INDEXABLE_FILES,
    maxValue: 10_000n,
  },
  {
    planKey: 'free',
    metric: IndexingResourceMetric.INDEXED_TOKENS,
    maxValue: 2_000_000n,
  },
  {
    planKey: 'free',
    metric: IndexingResourceMetric.EMBEDDING_CHUNKS,
    maxValue: 15_000n,
  },
  {
    planKey: 'free',
    metric: IndexingResourceMetric.FILE_SIZE_BYTES,
    maxValue: BigInt(1 * MB),
  },
  {
    planKey: 'pro',
    metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
    maxValue: BigInt(1 * GB),
  },
  {
    planKey: 'pro',
    metric: IndexingResourceMetric.INDEXABLE_FILES,
    maxValue: 50_000n,
  },
  {
    planKey: 'pro',
    metric: IndexingResourceMetric.INDEXED_TOKENS,
    maxValue: 10_000_000n,
  },
  {
    planKey: 'pro',
    metric: IndexingResourceMetric.EMBEDDING_CHUNKS,
    maxValue: 50_000n,
  },
  {
    planKey: 'pro',
    metric: IndexingResourceMetric.FILE_SIZE_BYTES,
    maxValue: BigInt(2 * MB),
  },
  {
    planKey: 'enterprise',
    metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
    maxValue: BigInt(1 * GB),
  },
  {
    planKey: 'enterprise',
    metric: IndexingResourceMetric.INDEXABLE_FILES,
    maxValue: 50_000n,
  },
  {
    planKey: 'enterprise',
    metric: IndexingResourceMetric.INDEXED_TOKENS,
    maxValue: 10_000_000n,
  },
  {
    planKey: 'enterprise',
    metric: IndexingResourceMetric.EMBEDDING_CHUNKS,
    maxValue: 50_000n,
  },
  {
    planKey: 'enterprise',
    metric: IndexingResourceMetric.FILE_SIZE_BYTES,
    maxValue: BigInt(2 * MB),
  },
];

export async function upsertDefaultPlanIndexingLimits(
  prisma: Pick<PrismaClient, 'planIndexingLimit' | 'plan'>,
): Promise<Record<DefaultIndexingPlanKey, string>> {
  const planIds = await resolveDefaultPlanIds(prisma);
  for (const row of DEFAULT_PLAN_INDEXING_LIMIT_ROWS) {
    const planId = planIds[row.planKey];
    await prisma.planIndexingLimit.upsert({
      where: {
        planId_metric: {
          planId,
          metric: row.metric,
        },
      },
      update: {
        maxValue: row.maxValue,
      },
      create: {
        planId,
        metric: row.metric,
        maxValue: row.maxValue,
      },
    });
  }
  return planIds;
}

export async function seedUnlimitedPlanIndexingLimits(
  prisma: Pick<PrismaClient, 'planIndexingLimit'>,
  planId: string,
): Promise<void> {
  for (const metric of INDEXING_RESOURCE_METRICS) {
    await prisma.planIndexingLimit.upsert({
      where: {
        planId_metric: {
          planId,
          metric,
        },
      },
      update: {},
      create: {
        planId,
        metric,
        maxValue: null,
      },
    });
  }
}

async function resolveDefaultPlanIds(
  prisma: Pick<PrismaClient, 'plan'>,
): Promise<Record<DefaultIndexingPlanKey, string>> {
  const ids = {} as Record<DefaultIndexingPlanKey, string>;
  for (const key of DEFAULT_INDEXING_PLAN_KEYS) {
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { key },
      select: { id: true },
    });
    ids[key] = plan.id;
  }
  return ids;
}
