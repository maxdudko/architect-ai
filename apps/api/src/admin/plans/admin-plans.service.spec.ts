import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingMode, UsageMetric, UsagePeriod } from '@prisma/client';
import { AdminPlansService } from './admin-plans.service';

describe('AdminPlansService', () => {
  const planId = 'plan-1';

  let prisma: {
    plan: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    planPrice: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    planLimit: { upsert: jest.Mock };
  };
  let usageService: { getLimitsForPlan: jest.Mock };
  let billingService: {
    archiveStripePrice: jest.Mock;
    getOrCreateStripePrice: jest.Mock;
  };
  let service: AdminPlansService;

  beforeEach(() => {
    prisma = {
      plan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      planPrice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      planLimit: { upsert: jest.fn() },
    };
    usageService = { getLimitsForPlan: jest.fn() };
    billingService = {
      archiveStripePrice: jest.fn().mockResolvedValue(undefined),
      getOrCreateStripePrice: jest.fn().mockResolvedValue('price_stripe_new'),
    };
    service = new AdminPlansService(
      prisma as never,
      usageService as never,
      billingService as never,
    );
  });

  describe('createPlan', () => {
    it('throws a conflict when the key is already in use', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: planId, key: 'pro' });

      await expect(
        service.createPlan({ key: 'pro', name: 'PRO' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.plan.create).not.toHaveBeenCalled();
    });

    it('creates a plan with defaults applied', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      prisma.plan.create.mockResolvedValue({
        id: 'plan-new',
        key: 'growth',
        name: 'Growth',
        description: null,
        isContactSales: false,
        isActive: true,
        sortOrder: 0,
        prices: [],
        limits: [],
      });

      const result = await service.createPlan({
        key: 'growth',
        name: 'Growth',
      });

      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          key: 'growth',
          name: 'Growth',
          description: null,
          isContactSales: false,
          sortOrder: 0,
        },
        include: { prices: true, limits: true },
      });
      expect(result.key).toBe('growth');
    });
  });

  describe('updatePlan', () => {
    it('throws when the plan does not exist', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePlan(planId, { name: 'New name' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates only the provided fields', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: planId });
      prisma.plan.update.mockResolvedValue({
        id: planId,
        key: 'pro',
        name: 'PRO Plus',
        description: null,
        isContactSales: false,
        isActive: true,
        sortOrder: 1,
        prices: [],
        limits: [],
      });

      await service.updatePlan(planId, { name: 'PRO Plus', sortOrder: 1 });

      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { name: 'PRO Plus', sortOrder: 1 },
        include: { prices: true, limits: true },
      });
    });
  });

  describe('upsertPrice', () => {
    it('throws when the plan does not exist', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertPrice(planId, BillingMode.STANDARD, { amount: 2000 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a new price and eagerly provisions it in Stripe', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        name: 'PRO',
        key: 'pro',
      });
      prisma.planPrice.findUnique.mockResolvedValue(null);
      prisma.planPrice.create.mockResolvedValue({
        id: 'price-1',
        planId,
        billingMode: BillingMode.STANDARD,
        interval: 'MONTHLY',
        amount: 2000,
        currency: 'usd',
        stripePriceId: null,
      });

      const result = await service.upsertPrice(planId, BillingMode.STANDARD, {
        amount: 2000,
      });

      expect(prisma.planPrice.create).toHaveBeenCalledWith({
        data: {
          planId,
          billingMode: BillingMode.STANDARD,
          interval: 'MONTHLY',
          amount: 2000,
          currency: 'usd',
        },
      });
      expect(billingService.getOrCreateStripePrice).toHaveBeenCalled();
      expect(billingService.archiveStripePrice).not.toHaveBeenCalled();
      expect(result.stripePriceId).toBe('price_stripe_new');
    });

    it('archives the old Stripe price and re-provisions when the amount changes', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        name: 'PRO',
        key: 'pro',
      });
      prisma.planPrice.findUnique.mockResolvedValue({
        id: 'price-1',
        planId,
        billingMode: BillingMode.STANDARD,
        interval: 'MONTHLY',
        amount: 2000,
        currency: 'usd',
        stripePriceId: 'price_stripe_old',
      });
      prisma.planPrice.update.mockResolvedValue({
        id: 'price-1',
        planId,
        billingMode: BillingMode.STANDARD,
        interval: 'MONTHLY',
        amount: 2500,
        currency: 'usd',
        stripePriceId: null,
      });

      const result = await service.upsertPrice(planId, BillingMode.STANDARD, {
        amount: 2500,
      });

      expect(prisma.planPrice.update).toHaveBeenCalledWith({
        where: { id: 'price-1' },
        data: { amount: 2500, currency: 'usd', stripePriceId: null },
      });
      expect(billingService.archiveStripePrice).toHaveBeenCalledWith(
        'price_stripe_old',
      );
      expect(billingService.getOrCreateStripePrice).toHaveBeenCalled();
      expect(result.stripePriceId).toBe('price_stripe_new');
    });

    it('does not touch Stripe when the amount and currency are unchanged', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        name: 'PRO',
        key: 'pro',
      });
      prisma.planPrice.findUnique.mockResolvedValue({
        id: 'price-1',
        planId,
        billingMode: BillingMode.STANDARD,
        interval: 'MONTHLY',
        amount: 2000,
        currency: 'usd',
        stripePriceId: 'price_stripe_existing',
      });
      prisma.planPrice.update.mockResolvedValue({
        id: 'price-1',
        planId,
        billingMode: BillingMode.STANDARD,
        interval: 'MONTHLY',
        amount: 2000,
        currency: 'usd',
        stripePriceId: 'price_stripe_existing',
      });

      const result = await service.upsertPrice(planId, BillingMode.STANDARD, {
        amount: 2000,
        currency: 'usd',
      });

      expect(billingService.archiveStripePrice).not.toHaveBeenCalled();
      expect(billingService.getOrCreateStripePrice).not.toHaveBeenCalled();
      expect(result.stripePriceId).toBe('price_stripe_existing');
    });
  });

  describe('updateLimits', () => {
    it('throws when the plan does not exist', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLimits(planId, [
          { metric: UsageMetric.AI_QUESTIONS, maxValue: 10 },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts each limit and de-duplicates repeated metrics', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: planId });
      usageService.getLimitsForPlan.mockResolvedValue([]);

      await service.updateLimits(planId, [
        { metric: UsageMetric.AI_QUESTIONS, maxValue: 10 },
        { metric: UsageMetric.AI_QUESTIONS, maxValue: 20 },
        { metric: UsageMetric.MEMBERS, maxValue: null },
      ]);

      expect(prisma.planLimit.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.planLimit.upsert).toHaveBeenCalledWith({
        where: { planId_metric: { planId, metric: UsageMetric.AI_QUESTIONS } },
        update: { maxValue: 10 },
        create: {
          planId,
          metric: UsageMetric.AI_QUESTIONS,
          period: UsagePeriod.MONTHLY,
          maxValue: 10,
        },
      });
      expect(prisma.planLimit.upsert).toHaveBeenCalledWith({
        where: { planId_metric: { planId, metric: UsageMetric.MEMBERS } },
        update: { maxValue: null },
        create: {
          planId,
          metric: UsageMetric.MEMBERS,
          period: UsagePeriod.CURRENT,
          maxValue: null,
        },
      });
    });
  });
});
