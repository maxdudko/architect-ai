import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingMode, SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const workspaceId = 'workspace-1';
  const planId = 'plan-pro';

  let stripe: {
    checkout: { sessions: { create: jest.Mock } };
    billingPortal: { sessions: { create: jest.Mock } };
    subscriptions: { update: jest.Mock; retrieve: jest.Mock };
    prices: { create: jest.Mock; update: jest.Mock };
    products: { create: jest.Mock };
    customers: { create: jest.Mock };
    webhooks: { constructEvent: jest.Mock };
  };
  let prisma: {
    workspace: {
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    plan: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    planPrice: { update: jest.Mock };
    workspaceSubscription: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    workspaceAiSettings: { findUnique: jest.Mock };
    stripeWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let service: BillingService;

  beforeEach(() => {
    stripe = {
      checkout: { sessions: { create: jest.fn() } },
      billingPortal: { sessions: { create: jest.fn() } },
      subscriptions: { update: jest.fn(), retrieve: jest.fn() },
      prices: { create: jest.fn(), update: jest.fn() },
      products: { create: jest.fn() },
      customers: { create: jest.fn() },
      webhooks: { constructEvent: jest.fn() },
    };
    prisma = {
      workspace: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      plan: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      planPrice: { update: jest.fn() },
      workspaceSubscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      workspaceAiSettings: { findUnique: jest.fn() },
      stripeWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'WEB_URL' ? 'https://app.example.com' : undefined,
      ),
    };
    service = new BillingService(
      stripe as never,
      prisma as never,
      configService as never,
    );
  });

  describe('createCheckoutSession', () => {
    it('throws when the workspace does not exist', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession(workspaceId, planId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when checking out the Free plan', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        planId: 'plan-pro',
      });
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-free',
        key: 'free',
        isActive: true,
        isContactSales: false,
        prices: [],
      });

      await expect(
        service.createCheckoutSession(workspaceId, 'plan-free'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('throws when the plan is contact-sales only', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        planId: 'plan-free',
      });
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        isActive: true,
        isContactSales: true,
        prices: [],
      });

      await expect(
        service.createCheckoutSession(workspaceId, planId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when no price is configured for the current billing mode', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        planId: 'plan-free',
      });
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        isActive: true,
        isContactSales: false,
        prices: [],
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession(workspaceId, planId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uses the STANDARD price and creates a checkout session when BYOK is inactive', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        planId: 'plan-free',
      });
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        name: 'PRO',
        key: 'pro',
        isActive: true,
        isContactSales: false,
        stripeProductId: 'prod_existing',
        prices: [
          {
            id: 'price-standard',
            billingMode: BillingMode.STANDARD,
            interval: 'MONTHLY',
            amount: 2000,
            currency: 'usd',
            stripePriceId: 'price_stripe_standard',
          },
          {
            id: 'price-byok',
            billingMode: BillingMode.BYOK,
            interval: 'MONTHLY',
            amount: 1200,
            currency: 'usd',
            stripePriceId: 'price_stripe_byok',
          },
        ],
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);
      prisma.workspaceSubscription.findUnique.mockResolvedValue(null);
      prisma.workspace.findUniqueOrThrow.mockResolvedValue({
        id: workspaceId,
        name: 'Acme',
        planId: 'plan-free',
      });
      stripe.customers.create.mockResolvedValue({ id: 'cus_123' });
      prisma.workspaceSubscription.upsert.mockResolvedValue({});
      stripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
      });

      const result = await service.createCheckoutSession(workspaceId, planId);

      expect(result.url).toBe('https://checkout.stripe.com/session_123');
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          line_items: [{ price: 'price_stripe_standard', quantity: 1 }],
          success_url:
            'https://app.example.com/workspace/settings?billing=success',
          cancel_url:
            'https://app.example.com/workspace/settings?billing=cancel',
        }),
      );
    });

    it('uses the STANDARD price even when the workspace has an active AI provider', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        planId: 'plan-free',
      });
      prisma.plan.findUnique.mockResolvedValue({
        id: planId,
        name: 'PRO',
        key: 'pro',
        isActive: true,
        isContactSales: false,
        stripeProductId: 'prod_existing',
        prices: [
          {
            id: 'price-standard',
            billingMode: BillingMode.STANDARD,
            interval: 'MONTHLY',
            amount: 2000,
            currency: 'usd',
            stripePriceId: 'price_stripe_standard',
          },
          {
            id: 'price-byok',
            billingMode: BillingMode.BYOK,
            interval: 'MONTHLY',
            amount: 1200,
            currency: 'usd',
            stripePriceId: 'price_stripe_byok',
          },
        ],
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue({
        activeProvider: 'OPENAI',
      });
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_existing',
      });
      stripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_456',
      });

      const result = await service.createCheckoutSession(workspaceId, planId);

      expect(result.url).toBe('https://checkout.stripe.com/session_456');
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
          line_items: [{ price: 'price_stripe_standard', quantity: 1 }],
        }),
      );
    });
  });

  describe('getOrCreateStripePrice', () => {
    it('returns the existing stripePriceId without calling Stripe', async () => {
      const plan = {
        id: planId,
        name: 'PRO',
        key: 'pro',
        stripeProductId: 'prod_1',
      } as never;
      const price = {
        id: 'price-1',
        billingMode: BillingMode.STANDARD,
        amount: 2000,
        currency: 'usd',
        stripePriceId: 'price_existing',
      } as never;

      const result = await service.getOrCreateStripePrice(plan, price);

      expect(result).toBe('price_existing');
      expect(stripe.prices.create).not.toHaveBeenCalled();
    });

    it('lazily creates a Stripe product and price when missing', async () => {
      const plan = {
        id: planId,
        name: 'PRO',
        key: 'pro',
        stripeProductId: null,
      } as never;
      const price = {
        id: 'price-1',
        billingMode: BillingMode.STANDARD,
        amount: 2000,
        currency: 'usd',
        stripePriceId: null,
      } as never;
      stripe.products.create.mockResolvedValue({ id: 'prod_new' });
      stripe.prices.create.mockResolvedValue({ id: 'price_new' });
      prisma.plan.update.mockResolvedValue({});
      prisma.planPrice.update.mockResolvedValue({});

      const result = await service.getOrCreateStripePrice(plan, price);

      expect(result).toBe('price_new');
      expect(stripe.products.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'PRO' }),
      );
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { stripeProductId: 'prod_new' },
      });
      expect(prisma.planPrice.update).toHaveBeenCalledWith({
        where: { id: 'price-1' },
        data: { stripePriceId: 'price_new' },
      });
    });
  });

  describe('syncBillingModeForWorkspace', () => {
    it('does nothing when the workspace has no active paid subscription', async () => {
      prisma.workspaceSubscription.findUnique.mockResolvedValue(null);

      await service.syncBillingModeForWorkspace(workspaceId);

      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('does nothing when the billing mode already matches', async () => {
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionItemId: 'si_1',
        status: SubscriptionStatus.ACTIVE,
        billingMode: BillingMode.STANDARD,
        planId,
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);

      await service.syncBillingModeForWorkspace(workspaceId);

      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('persists billing mode on a BYOK toggle without swapping the Stripe price', async () => {
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionItemId: 'si_1',
        status: SubscriptionStatus.ACTIVE,
        billingMode: BillingMode.STANDARD,
        planId,
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue({
        activeProvider: 'OPENAI',
      });
      prisma.workspaceSubscription.update.mockResolvedValue({});

      await service.syncBillingModeForWorkspace(workspaceId);

      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      expect(prisma.workspaceSubscription.update).toHaveBeenCalledWith({
        where: { workspaceId },
        data: { billingMode: BillingMode.BYOK },
      });
    });

    it('does not change the Stripe price when the subscription is canceled', async () => {
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionItemId: 'si_1',
        status: SubscriptionStatus.CANCELED,
        billingMode: BillingMode.STANDARD,
        planId,
      });

      await service.syncBillingModeForWorkspace(workspaceId);

      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookEvent', () => {
    const rawBody = Buffer.from('{}');

    it('throws on an invalid Stripe signature', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
      );
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('signature mismatch');
      });

      await expect(
        service.handleWebhookEvent(rawBody, 'bad-signature'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is idempotent for already-processed events', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
      );
      stripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: {} },
      });
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_1' });

      await service.handleWebhookEvent(rawBody, 'sig');

      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('records the event after processing an unhandled event type', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : undefined,
      );
      stripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'invoice.paid',
        data: { object: {} },
      });
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await service.handleWebhookEvent(rawBody, 'sig');

      expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_2', type: 'invoice.paid' },
      });
    });
  });

  describe('scheduleDowngradeToFree', () => {
    const periodEnd = new Date('2026-09-21T00:00:00.000Z');

    it('sets Stripe cancel_at_period_end without changing the plan immediately', async () => {
      prisma.workspace.findFirst
        .mockResolvedValueOnce({
          id: workspaceId,
          plan: { key: 'pro' },
        })
        .mockResolvedValueOnce({
          plan: {
            id: planId,
            key: 'pro',
            name: 'PRO',
            isContactSales: false,
          },
        });
      prisma.workspaceSubscription.findUnique
        .mockResolvedValueOnce({
          stripeSubscriptionId: 'sub_1',
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
        })
        .mockResolvedValueOnce({
          billingMode: BillingMode.STANDARD,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
          stripeCustomerId: 'cus_1',
        });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);
      stripe.subscriptions.update.mockResolvedValue({
        cancel_at_period_end: true,
        items: { data: [{ current_period_end: 1789948800 }] },
      });
      prisma.workspaceSubscription.update.mockResolvedValue({});

      const result = await service.scheduleDowngradeToFree(workspaceId);

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
      });
      expect(prisma.workspace.update).not.toHaveBeenCalled();
      expect(prisma.workspaceSubscription.update).toHaveBeenCalledWith({
        where: { workspaceId },
        data: expect.objectContaining({ cancelAtPeriodEnd: true }),
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.plan.key).toBe('pro');
    });

    it('throws when the workspace is already on Free', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        plan: { key: 'free' },
      });

      await expect(
        service.scheduleDowngradeToFree(workspaceId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('throws when there is no active Stripe subscription', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        id: workspaceId,
        plan: { key: 'pro' },
      });
      prisma.workspaceSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.scheduleDowngradeToFree(workspaceId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is a no-op when cancellation is already scheduled', async () => {
      prisma.workspace.findFirst
        .mockResolvedValueOnce({
          id: workspaceId,
          plan: { key: 'pro' },
        })
        .mockResolvedValueOnce({
          plan: {
            id: planId,
            key: 'pro',
            name: 'PRO',
            isContactSales: false,
          },
        });
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        billingMode: BillingMode.STANDARD,
        stripeCustomerId: 'cus_1',
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);

      const result = await service.scheduleDowngradeToFree(workspaceId);

      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      expect(result.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe('resumePaidSubscription', () => {
    const periodEnd = new Date('2026-09-21T00:00:00.000Z');

    it('clears cancel_at_period_end on Stripe', async () => {
      prisma.workspaceSubscription.findUnique
        .mockResolvedValueOnce({
          stripeSubscriptionId: 'sub_1',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: periodEnd,
        })
        .mockResolvedValueOnce({
          billingMode: BillingMode.STANDARD,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          stripeCustomerId: 'cus_1',
        });
      prisma.workspace.findFirst.mockResolvedValue({
        plan: {
          id: planId,
          key: 'pro',
          name: 'PRO',
          isContactSales: false,
        },
      });
      prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);
      stripe.subscriptions.update.mockResolvedValue({
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: 1789948800 }] },
      });
      prisma.workspaceSubscription.update.mockResolvedValue({});

      const result = await service.resumePaidSubscription(workspaceId);

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: false,
      });
      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('throws when no downgrade is scheduled', async () => {
      prisma.workspaceSubscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        cancelAtPeriodEnd: false,
      });

      await expect(
        service.resumePaidSubscription(workspaceId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
