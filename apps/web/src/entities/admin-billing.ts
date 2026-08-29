import type { BillingInterval, BillingMode } from './billing';
import type { IndexingResourceMetric, UsageMetric, UsagePeriod } from './usage';

export interface AdminPlanPrice {
  id: string;
  billingMode: BillingMode;
  interval: BillingInterval;
  amount: number;
  currency: string;
  stripePriceId: string | null;
}

export interface AdminPlanLimitRow {
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}

export interface AdminPlanIndexingLimit {
  metric: IndexingResourceMetric;
  maxValue: number | null;
}

export interface AdminPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isContactSales: boolean;
  isActive: boolean;
  sortOrder: number;
  prices: AdminPlanPrice[];
  limits: AdminPlanLimitRow[];
  indexingLimits: AdminPlanIndexingLimit[];
}

export interface CreatePlanPayload {
  key: string;
  name: string;
  description?: string;
  isContactSales?: boolean;
  sortOrder?: number;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string | null;
  isContactSales?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpsertPlanPricePayload {
  amount: number;
  currency?: string;
}
