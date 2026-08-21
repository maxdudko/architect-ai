import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  BillingMode,
  Plan,
  PlanLimit,
  PlanPrice,
  UsageMetric,
} from '@prisma/client';
import { BillingService } from '../../billing/billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { USAGE_METRICS, UsageService } from '../../usage/usage.service';
import { AdminPlanDto, AdminPlanPriceDto } from './dto/admin-plan-response.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpsertPlanPriceDto } from './dto/upsert-plan-price.dto';

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
    private readonly billingService: BillingService,
  ) {}

  async listPlans(): Promise<AdminPlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { prices: true, limits: true },
    });
    return plans.map((plan) => this.toPlanDto(plan));
  }

  async createPlan(dto: CreatePlanDto): Promise<AdminPlanDto> {
    const existing = await this.prisma.plan.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `A plan with key "${dto.key}" already exists`,
      );
    }

    const plan = await this.prisma.plan.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        isContactSales: dto.isContactSales ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { prices: true, limits: true },
    });
    return this.toPlanDto(plan);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<AdminPlanDto> {
    await this.assertPlanExists(planId);
    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.isContactSales !== undefined
          ? { isContactSales: dto.isContactSales }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { prices: true, limits: true },
    });
    return this.toPlanDto(plan);
  }

  async upsertPrice(
    planId: string,
    billingMode: BillingMode,
    dto: UpsertPlanPriceDto,
  ): Promise<AdminPlanPriceDto> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const existing = await this.prisma.planPrice.findUnique({
      where: {
        planId_billingMode_interval: {
          planId,
          billingMode,
          interval: BillingInterval.MONTHLY,
        },
      },
    });

    const currency = (
      dto.currency ??
      existing?.currency ??
      'usd'
    ).toLowerCase();
    const amountOrCurrencyChanged =
      !existing ||
      existing.amount !== dto.amount ||
      existing.currency !== currency;

    let price: PlanPrice = existing
      ? await this.prisma.planPrice.update({
          where: { id: existing.id },
          data: {
            amount: dto.amount,
            currency,
            ...(amountOrCurrencyChanged ? { stripePriceId: null } : {}),
          },
        })
      : await this.prisma.planPrice.create({
          data: {
            planId,
            billingMode,
            interval: BillingInterval.MONTHLY,
            amount: dto.amount,
            currency,
          },
        });

    if (amountOrCurrencyChanged) {
      if (existing?.stripePriceId) {
        await this.billingService.archiveStripePrice(existing.stripePriceId);
      }
      const stripePriceId = await this.billingService.getOrCreateStripePrice(
        plan,
        price,
      );
      price = { ...price, stripePriceId };
    }

    return this.toPriceDto(price);
  }

  async getLimits(planId: string) {
    await this.assertPlanExists(planId);
    return this.usageService.getLimitsForPlan(planId);
  }

  async updateLimits(
    planId: string,
    limits: Array<{ metric: UsageMetric; maxValue: number | null }>,
  ) {
    await this.assertPlanExists(planId);
    const seen = new Set<UsageMetric>();
    for (const item of limits) {
      if (seen.has(item.metric)) {
        continue;
      }
      seen.add(item.metric);
      if (!USAGE_METRICS.includes(item.metric)) {
        continue;
      }
      await this.prisma.planLimit.upsert({
        where: {
          planId_metric: {
            planId,
            metric: item.metric,
          },
        },
        update: {
          maxValue: item.maxValue ?? null,
        },
        create: {
          planId,
          metric: item.metric,
          period: defaultPeriodForMetric(item.metric),
          maxValue: item.maxValue ?? null,
        },
      });
    }
    return this.usageService.getLimitsForPlan(planId);
  }

  private async assertPlanExists(planId: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private toPlanDto(
    plan: Plan & { prices: PlanPrice[]; limits: PlanLimit[] },
  ): AdminPlanDto {
    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      isContactSales: plan.isContactSales,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      prices: plan.prices.map((price) => this.toPriceDto(price)),
      limits: plan.limits.map((limit) => ({
        metric: limit.metric,
        period: limit.period,
        maxValue: limit.maxValue,
      })),
    };
  }

  private toPriceDto(price: PlanPrice): AdminPlanPriceDto {
    return {
      id: price.id,
      billingMode: price.billingMode,
      interval: price.interval,
      amount: price.amount,
      currency: price.currency,
      stripePriceId: price.stripePriceId,
    };
  }
}

function defaultPeriodForMetric(metric: UsageMetric): 'CURRENT' | 'MONTHLY' {
  return metric === UsageMetric.REPOSITORIES || metric === UsageMetric.MEMBERS
    ? 'CURRENT'
    : 'MONTHLY';
}
