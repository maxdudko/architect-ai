import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvitationStatus,
  MembershipStatus,
  MessageRole,
  UsageMetric,
  UsagePeriod,
  WorkspacePlan,
} from '@prisma/client';
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

export interface WorkspaceUsageSnapshot {
  workspaceId: string;
  plan: WorkspacePlan;
  aiMode: 'HOSTED' | 'BYOK';
  metrics: UsageMetricSnapshot[];
}

export type MemberCountMode = 'seats' | 'active';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getLimitsForPlan(plan: WorkspacePlan): Promise<
    Array<{
      metric: UsageMetric;
      period: UsagePeriod;
      maxValue: number | null;
    }>
  > {
    const rows = await this.prisma.planLimit.findMany({
      where: { plan },
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
        plan: true,
        aiSettings: { select: { openaiApiKeyEncrypted: true } },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isByok = hasByokKey(workspace.aiSettings);
    const limits = await this.getLimitsForPlan(workspace.plan);
    const metrics = await Promise.all(
      limits.map(async (limit) => {
        const used = await this.countUsed(workspaceId, limit.metric, {
          period: limit.period,
          memberCountMode: 'seats',
        });
        const effective = effectiveLimit(limit.maxValue, limit.metric, isByok);
        return {
          metric: limit.metric,
          period: limit.period,
          used,
          limit: effective,
          remaining:
            effective == null ? null : Math.max(effective - used, 0),
        };
      }),
    );

    return {
      workspaceId: workspace.id,
      plan: workspace.plan,
      aiMode: isByok ? 'BYOK' : 'HOSTED',
      metrics,
    };
  }

  async assertWithinLimit(
    workspaceId: string,
    metric: UsageMetric,
    options?: { memberCountMode?: MemberCountMode },
  ): Promise<void> {
    const snapshot = await this.getMetricSnapshot(workspaceId, metric, options);
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
    options?: { memberCountMode?: MemberCountMode },
  ): Promise<UsageMetricSnapshot> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        plan: true,
        aiSettings: { select: { openaiApiKeyEncrypted: true } },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const row = await this.prisma.planLimit.findUnique({
      where: {
        plan_metric: {
          plan: workspace.plan,
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
      memberCountMode: options?.memberCountMode ?? 'seats',
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
    options: { period: UsagePeriod; memberCountMode: MemberCountMode },
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
          },
        });
      case UsageMetric.GUIDE_GENERATIONS:
        return this.prisma.guideGenerationRun.count({
          where: {
            workspaceId,
            ...(monthStart ? { createdAt: { gte: monthStart } } : {}),
          },
        });
      case UsageMetric.AI_QUESTIONS:
        return this.prisma.message.count({
          where: {
            role: MessageRole.USER,
            ...(monthStart ? { createdAt: { gte: monthStart } } : {}),
            conversation: { workspaceId, deletedAt: null },
          },
        });
      case UsageMetric.MEMBERS: {
        const activeMembers = await this.prisma.membership.count({
          where: {
            workspaceId,
            status: MembershipStatus.ACTIVE,
            deletedAt: null,
          },
        });
        if (options.memberCountMode === 'active') {
          return activeMembers;
        }
        const pendingInvitations = await this.prisma.invitation.count({
          where: {
            workspaceId,
            status: InvitationStatus.PENDING,
            deletedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        return activeMembers + pendingInvitations;
      }
      default:
        return 0;
    }
  }
}

function hasByokKey(
  aiSettings: { openaiApiKeyEncrypted: string | null } | null | undefined,
): boolean {
  return Boolean(aiSettings?.openaiApiKeyEncrypted);
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
