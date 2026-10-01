import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipStatus,
  MessageRole,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';
import { INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE } from './indexing-resource-limit.error';
import {
  toNumberLimit,
  type IndexingResourceLimitSnapshot,
} from './indexing-resource-limit.service';
import { INDEXING_RESOURCE_METRICS } from './plan-indexing-limit.defaults';
import { PrismaService } from '../prisma/prisma.service';
import { UsageLimitExceededException } from './usage-limit.exception';

export const USAGE_METRICS: UsageMetric[] = [
  UsageMetric.REPOSITORIES,
  UsageMetric.INDEXING_RUNS,
  UsageMetric.GUIDE_GENERATIONS,
  UsageMetric.AI_QUESTIONS,
  UsageMetric.MEMBERS,
];

/** LLM metrics billed to the workspace key; Hosted AI still uses plan caps. */
export const BYOK_UNLIMITED_METRICS: ReadonlySet<UsageMetric> = new Set([
  UsageMetric.AI_QUESTIONS,
  UsageMetric.GUIDE_GENERATIONS,
]);

export interface UsageMetricSnapshot {
  metric: UsageMetric;
  period: UsagePeriod;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface PlanSummary {
  id: string;
  key: string;
  name: string;
}

export { type IndexingResourceLimitSnapshot } from './indexing-resource-limit.service';

export interface WorkspaceUsageSnapshot {
  workspaceId: string;
  plan: PlanSummary;
  aiMode: 'HOSTED' | 'BYOK';
  metrics: UsageMetricSnapshot[];
  indexingLimits: IndexingResourceLimitSnapshot[];
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getLimitsForPlan(planId: string): Promise<
    Array<{
      metric: UsageMetric;
      period: UsagePeriod;
      maxValue: number | null;
    }>
  > {
    const rows = await this.prisma.planLimit.findMany({
      where: { planId },
      orderBy: { metric: 'asc' },
    });

    const byMetric = new Map(rows.map((row) => [row.metric, row]));
    return USAGE_METRICS.map((metric) => {
      const row = byMetric.get(metric);
      return {
        metric,
        period: row?.period ?? defaultPeriodForMetric(metric),
        maxValue: row?.maxValue ?? null,
      };
    });
  }

  async getWorkspaceUsage(
    workspaceId: string,
  ): Promise<WorkspaceUsageSnapshot> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        plan: { select: { id: true, key: true, name: true } },
        aiSettings: { select: { activeProvider: true } },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isByok = hasByokKey(workspace.aiSettings);
    const limits = await this.getLimitsForPlan(workspace.plan.id);
    const metrics = await Promise.all(
      limits.map(async (limit) => {
        const used = await this.countUsed(workspaceId, limit.metric, {
          period: limit.period,
        });
        const effective = effectiveLimit(limit.maxValue, limit.metric, isByok);
        return {
          metric: limit.metric,
          period: limit.period,
          used,
          limit: effective,
          remaining: effective == null ? null : Math.max(effective - used, 0),
        };
      }),
    );

    const indexingRows = await this.prisma.planIndexingLimit.findMany({
      where: { planId: workspace.plan.id },
    });
    const indexingByMetric = new Map(
      indexingRows.map((row) => [row.metric, row.maxValue]),
    );
    const indexingLimits = INDEXING_RESOURCE_METRICS.map((metric) => ({
      metric,
      maxValue: toNumberLimit(indexingByMetric.get(metric) ?? null),
    }));

    return {
      workspaceId: workspace.id,
      plan: workspace.plan,
      aiMode: isByok ? 'BYOK' : 'HOSTED',
      metrics,
      indexingLimits,
    };
  }

  async assertWithinLimit(
    workspaceId: string,
    metric: UsageMetric,
  ): Promise<void> {
    const snapshot = await this.getMetricSnapshot(workspaceId, metric);
    if (snapshot.limit == null) {
      return;
    }
    if (snapshot.used >= snapshot.limit) {
      throw new UsageLimitExceededException({
        metric,
        used: snapshot.used,
        limit: snapshot.limit,
        period: snapshot.period,
      });
    }
  }

  async hasRemaining(
    workspaceId: string,
    metric: UsageMetric,
  ): Promise<boolean> {
    const snapshot = await this.getMetricSnapshot(workspaceId, metric);
    if (snapshot.limit == null) {
      return true;
    }
    return snapshot.used < snapshot.limit;
  }

  private async getMetricSnapshot(
    workspaceId: string,
    metric: UsageMetric,
  ): Promise<UsageMetricSnapshot> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        planId: true,
        aiSettings: { select: { activeProvider: true } },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const row = await this.prisma.planLimit.findUnique({
      where: {
        planId_metric: {
          planId: workspace.planId,
          metric,
        },
      },
    });
    const period = row?.period ?? defaultPeriodForMetric(metric);
    const limit = effectiveLimit(
      row?.maxValue ?? null,
      metric,
      hasByokKey(workspace.aiSettings),
    );
    const used = await this.countUsed(workspaceId, metric, {
      period,
    });

    return {
      metric,
      period,
      used,
      limit,
      remaining: limit == null ? null : Math.max(limit - used, 0),
    };
  }

  private async countUsed(
    workspaceId: string,
    metric: UsageMetric,
    options: { period: UsagePeriod },
  ): Promise<number> {
    const monthStart =
      options.period === UsagePeriod.MONTHLY
        ? startOfUtcMonth(new Date())
        : undefined;

    switch (metric) {
      case UsageMetric.REPOSITORIES:
        return this.prisma.repository.count({
          where: { workspaceId, deletedAt: null },
        });
      case UsageMetric.INDEXING_RUNS:
        return this.prisma.indexingRun.count({
          where: {
            repository: { workspaceId, deletedAt: null },
            ...(monthStart ? { startedAt: { gte: monthStart } } : {}),
            NOT: {
              AND: [
                { status: 'FAILED' },
                {
                  errors: {
                    path: ['code'],
                    equals: INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
                  },
                },
              ],
            },
          },
        });
      case UsageMetric.GUIDE_GENERATIONS: {
        const createdAt = monthStart ? { gte: monthStart } : undefined;
        const [guideRuns, overviewRuns] = await Promise.all([
          this.prisma.guideGenerationRun.count({
            where: { workspaceId, ...(createdAt ? { createdAt } : {}) },
          }),
          this.prisma.architectureOverviewGenerationRun.count({
            where: { workspaceId, ...(createdAt ? { createdAt } : {}) },
          }),
        ]);
        return guideRuns + overviewRuns;
      }
      case UsageMetric.AI_QUESTIONS:
        return this.prisma.message.count({
          where: {
            role: MessageRole.USER,
            ...(monthStart ? { createdAt: { gte: monthStart } } : {}),
            conversation: { workspaceId, deletedAt: null },
          },
        });
      case UsageMetric.MEMBERS:
        return this.prisma.membership.count({
          where: {
            workspaceId,
            status: MembershipStatus.ACTIVE,
            deletedAt: null,
          },
        });
      default:
        return 0;
    }
  }
}

function hasByokKey(
  aiSettings: { activeProvider: unknown } | null | undefined,
): boolean {
  return Boolean(aiSettings?.activeProvider);
}

function effectiveLimit(
  planMaxValue: number | null,
  metric: UsageMetric,
  isByok: boolean,
): number | null {
  if (isByok && BYOK_UNLIMITED_METRICS.has(metric)) {
    return null;
  }
  return planMaxValue;
}

function defaultPeriodForMetric(metric: UsageMetric): UsagePeriod {
  if (metric === UsageMetric.REPOSITORIES || metric === UsageMetric.MEMBERS) {
    return UsagePeriod.CURRENT;
  }
  return UsagePeriod.MONTHLY;
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
