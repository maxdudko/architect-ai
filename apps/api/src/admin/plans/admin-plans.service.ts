import { Injectable, NotFoundException } from '@nestjs/common';
import { UsageMetric, WorkspacePlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { USAGE_METRICS, UsageService } from '../../usage/usage.service';

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  getLimits(plan: WorkspacePlan) {
    this.assertPlan(plan);
    return this.usageService.getLimitsForPlan(plan);
  }

  async updateLimits(
    plan: WorkspacePlan,
    limits: Array<{ metric: UsageMetric; maxValue: number | null }>,
  ) {
    this.assertPlan(plan);
    const seen = new Set<UsageMetric>();
    for (const item of limits) {
      if (seen.has(item.metric)) {
        continue;
      }
      seen.add(item.metric);
      if (!USAGE_METRICS.includes(item.metric)) {
        continue;
      }
      await this.prisma.planLimit.update({
        where: {
          plan_metric: {
            plan,
            metric: item.metric,
          },
        },
        data: {
          maxValue: item.maxValue ?? null,
        },
      });
    }
    return this.usageService.getLimitsForPlan(plan);
  }

  private assertPlan(plan: string): asserts plan is WorkspacePlan {
    if (!Object.values(WorkspacePlan).includes(plan as WorkspacePlan)) {
      throw new NotFoundException('Plan not found');
    }
  }
}
