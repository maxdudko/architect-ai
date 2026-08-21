import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingInterval,
  BillingMode,
  Plan,
  PlanPrice,
  SubscriptionStatus,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { USAGE_METRICS } from '../usage/usage.service';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { WorkspaceBillingResponseDto } from './dto/workspace-billing-response.dto';
import { STRIPE_CLIENT } from './stripe-client.token';

const FREE_PLAN_KEY = 'free';

const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
]);

function unixToDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000) : null;
}

/** Stripe moved period fields from the Subscription to its first item; support either shape. */
function readCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0];
  const legacy = subscription as unknown as { current_period_end?: number };
  return unixToDate(item?.current_period_end ?? legacy.current_period_end);
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listPublicPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { prices: true, limits: true },
    });

    return plans.map((plan) => {
      const limitByMetric = new Map(
        plan.limits.map((limit) => [limit.metric, limit]),
      );
      return {
        id: plan.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        isContactSales: plan.isContactSales,
        sortOrder: plan.sortOrder,
        prices: plan.prices.map((price) => ({
          billingMode: price.billingMode,
          interval: price.interval,
          amount: price.amount,
          currency: price.currency,
        })),
        limits: USAGE_METRICS.map((metric) => {
          const row = limitByMetric.get(metric);
          return {
            metric,
            period: row?.period ?? defaultPeriodForMetric(metric),
            maxValue: row?.maxValue ?? null,
          };
        }),
      };
    });
  }

  async getWorkspaceBilling(
    workspaceId: string,
  ): Promise<WorkspaceBillingResponseDto> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        plan: {
          select: { id: true, key: true, name: true, isContactSales: true },
        },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    const isByok = await this.isByokActive(workspaceId);

    return {
      plan: workspace.plan,
      billingMode:
        subscription?.billingMode ??
        (isByok ? BillingMode.BYOK : BillingMode.STANDARD),
      status: subscription?.status ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      hasBillingAccount: Boolean(subscription?.stripeCustomerId),
    };
  }

  async createCheckoutSession(
    workspaceId: string,
    planId: string,
  ): Promise<CheckoutSessionResponseDto> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { prices: true },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found');
    }
    if (plan.isContactSales) {
      throw new BadRequestException(
        'This plan is contact-sales only. Reach out to sales to get set up.',
      );
    }
    if (plan.key === FREE_PLAN_KEY) {
      throw new BadRequestException(
        'Downgrade to Free by canceling the paid subscription at period end.',
      );
    }

    const price = plan.prices.find(
      (candidate) =>
        candidate.billingMode === BillingMode.STANDARD &&
        candidate.interval === BillingInterval.MONTHLY,
    );
    if (!price) {
      throw new BadRequestException(
        'This plan does not have a price configured yet. Try again later.',
      );
    }

    const stripePriceId = await this.getOrCreateStripePrice(plan, price);
    const customerId = await this.getOrCreateStripeCustomer(workspaceId);
    const webUrl = this.resolveWebUrl();

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: workspaceId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${webUrl}/workspace/settings?billing=success`,
      cancel_url: `${webUrl}/workspace/settings?billing=cancel`,
      subscription_data: {
        metadata: { workspaceId, planId: plan.id },
      },
      metadata: { workspaceId, planId: plan.id },
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a checkout URL',
      );
    }
    return { url: session.url };
  }

  async createPortalSession(
    workspaceId: string,
  ): Promise<CheckoutSessionResponseDto> {
    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException(
        'No billing account yet. Upgrade a plan first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${this.resolveWebUrl()}/workspace/settings`,
    });
    return { url: session.url };
  }

  /**
   * Schedules a move to Free when the current paid period ends. The workspace
   * keeps its paid plan until Stripe sends customer.subscription.deleted.
   */
  async scheduleDowngradeToFree(
    workspaceId: string,
  ): Promise<WorkspaceBillingResponseDto> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, plan: { select: { key: true } } },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.plan.key === FREE_PLAN_KEY) {
      throw new BadRequestException('Workspace is already on the Free plan');
    }

    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (
      !subscription?.stripeSubscriptionId ||
      !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
    ) {
      throw new BadRequestException(
        'No active paid subscription to cancel. Upgrade a plan first.',
      );
    }
    if (subscription.cancelAtPeriodEnd) {
      return this.getWorkspaceBilling(workspaceId);
    }

    const updated = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd:
          readCurrentPeriodEnd(updated) ?? subscription.currentPeriodEnd,
      },
    });

    return this.getWorkspaceBilling(workspaceId);
  }

  /**
   * Reverses a scheduled period-end cancellation so the paid plan continues.
   */
  async resumePaidSubscription(
    workspaceId: string,
  ): Promise<WorkspaceBillingResponseDto> {
    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (
      !subscription?.stripeSubscriptionId ||
      !subscription.cancelAtPeriodEnd
    ) {
      throw new BadRequestException(
        'There is no scheduled downgrade to resume.',
      );
    }

    const updated = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: false },
    );

    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd:
          readCurrentPeriodEnd(updated) ?? subscription.currentPeriodEnd,
      },
    });

    return this.getWorkspaceBilling(workspaceId);
  }

  /**
   * Records whether BYOK is active for the workspace. Plan price is fixed
   * (standard); BYOK only uncaps AI questions and onboarding guides.
   */
  async syncBillingModeForWorkspace(workspaceId: string): Promise<void> {
    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (!subscription) {
      return;
    }

    const nextMode = (await this.isByokActive(workspaceId))
      ? BillingMode.BYOK
      : BillingMode.STANDARD;
    if (nextMode === subscription.billingMode) {
      return;
    }

    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: { billingMode: nextMode },
    });
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new InternalServerErrorException(
        'Stripe webhook secret is not configured',
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe signature: ${(error as Error).message}`,
      );
    }

    const alreadyProcessed = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (alreadyProcessed) {
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }

    await this.prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  }

  async getOrCreateStripePrice(plan: Plan, price: PlanPrice): Promise<string> {
    if (price.stripePriceId) {
      return price.stripePriceId;
    }

    const productId = await this.getOrCreateStripeProduct(plan);
    const stripePrice = await this.stripe.prices.create({
      product: productId,
      currency: price.currency,
      unit_amount: price.amount,
      recurring: { interval: 'month' },
      nickname: `${plan.name} (${price.billingMode})`,
      metadata: { planId: plan.id, billingMode: price.billingMode },
    });

    await this.prisma.planPrice.update({
      where: { id: price.id },
      data: { stripePriceId: stripePrice.id },
    });
    return stripePrice.id;
  }

  /** Deactivates a Stripe Price so it can no longer be used for new subscriptions. */
  async archiveStripePrice(stripePriceId: string): Promise<void> {
    await this.stripe.prices.update(stripePriceId, { active: false });
  }

  private async getOrCreateStripeProduct(plan: Plan): Promise<string> {
    if (plan.stripeProductId) {
      return plan.stripeProductId;
    }

    const product = await this.stripe.products.create({
      name: plan.name,
      metadata: { planId: plan.id, planKey: plan.key },
    });

    await this.prisma.plan.update({
      where: { id: plan.id },
      data: { stripeProductId: product.id },
    });
    return product.id;
  }

  private async getOrCreateStripeCustomer(
    workspaceId: string,
  ): Promise<string> {
    const existing = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    const customer = await this.stripe.customers.create({
      name: workspace.name,
      metadata: { workspaceId },
    });

    await this.prisma.workspaceSubscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        planId: workspace.planId,
        status: SubscriptionStatus.INCOMPLETE,
        stripeCustomerId: customer.id,
      },
      update: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  private async onCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const workspaceId =
      session.client_reference_id ?? session.metadata?.workspaceId;
    const planId = session.metadata?.planId;
    if (!workspaceId || !planId || !session.subscription || !session.customer) {
      this.logger.warn(
        `checkout.session.completed missing workspaceId/planId/subscription/customer (session ${session.id})`,
      );
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    const stripeSubscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const item = stripeSubscription.items.data[0];
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer.id;

    await this.prisma.$transaction([
      this.prisma.workspaceSubscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          planId,
          billingMode: (await this.isByokActive(workspaceId))
            ? BillingMode.BYOK
            : BillingMode.STANDARD,
          status: this.mapStripeStatus(stripeSubscription.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSubscription.id,
          stripeSubscriptionItemId: item?.id,
          currentPeriodEnd: readCurrentPeriodEnd(stripeSubscription),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
        update: {
          planId,
          status: this.mapStripeStatus(stripeSubscription.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSubscription.id,
          stripeSubscriptionItemId: item?.id,
          currentPeriodEnd: readCurrentPeriodEnd(stripeSubscription),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      }),
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { planId },
      }),
    ]);
  }

  private async onSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      return;
    }

    const item = subscription.items.data[0];
    await this.prisma.workspaceSubscription.update({
      where: { workspaceId: existing.workspaceId },
      data: {
        status: this.mapStripeStatus(subscription.status),
        stripeSubscriptionItemId: item?.id ?? existing.stripeSubscriptionItemId,
        currentPeriodEnd:
          readCurrentPeriodEnd(subscription) ?? existing.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async onSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.prisma.workspaceSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      return;
    }

    const freePlan = await this.prisma.plan.findUnique({
      where: { key: 'free' },
    });

    await this.prisma.$transaction([
      this.prisma.workspaceSubscription.update({
        where: { workspaceId: existing.workspaceId },
        data: {
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: false,
        },
      }),
      ...(freePlan
        ? [
            this.prisma.workspace.update({
              where: { id: existing.workspaceId },
              data: { planId: freePlan.id },
            }),
          ]
        : []),
    ]);
  }

  private mapStripeStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    switch (status) {
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'paused':
        return SubscriptionStatus.PAUSED;
      case 'incomplete':
      case 'incomplete_expired':
      default:
        return SubscriptionStatus.INCOMPLETE;
    }
  }

  private async isByokActive(workspaceId: string): Promise<boolean> {
    const settings = await this.prisma.workspaceAiSettings.findUnique({
      where: { workspaceId },
      select: { activeProvider: true },
    });
    return Boolean(settings?.activeProvider);
  }

  private resolveWebUrl(): string {
    return this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }
}

function defaultPeriodForMetric(metric: UsageMetric): UsagePeriod {
  return metric === UsageMetric.REPOSITORIES || metric === UsageMetric.MEMBERS
    ? UsagePeriod.CURRENT
    : UsagePeriod.MONTHLY;
}
