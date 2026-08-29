import type { PlanSummary } from './workspace';
import type { IndexingResourceMetric, UsageMetric, UsagePeriod } from './usage';

export type BillingMode = 'STANDARD' | 'BYOK';
export type BillingInterval = 'MONTHLY';
export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED';

export interface PlanPrice {
  billingMode: BillingMode;
  interval: BillingInterval;
  /** In the smallest currency unit (e.g. cents). */
  amount: number;
  currency: string;
}

export interface PlanLimit {
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}

export interface PlanIndexingLimit {
  metric: IndexingResourceMetric;
  maxValue: number | null;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isContactSales: boolean;
  sortOrder: number;
  prices: PlanPrice[];
  limits: PlanLimit[];
  indexingLimits: PlanIndexingLimit[];
}

export interface WorkspaceBilling {
  plan: PlanSummary & { isContactSales: boolean };
  billingMode: BillingMode;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBillingAccount: boolean;
}

export interface CheckoutSession {
  url: string;
}
