import type { BillingMode, Plan, PlanPrice, WorkspaceAiMode } from '@/entities';

export function billingModeForAiMode(aiMode: WorkspaceAiMode): BillingMode {
  return aiMode === 'BYOK' ? 'BYOK' : 'STANDARD';
}

export function isFreePlan(plan: { key: string }): boolean {
  return plan.key === 'free';
}

export function findMonthlyPrice(plan: Plan, billingMode: BillingMode): PlanPrice | undefined {
  return plan.prices.find(
    (price) => price.billingMode === billingMode && price.interval === 'MONTHLY',
  );
}

export function formatMoney(amountInSmallestUnit: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountInSmallestUnit % 100 === 0 ? 0 : 2,
  }).format(amountInSmallestUnit / 100);
}

export function formatMonthlyPrice(plan: Plan, billingMode: BillingMode): string {
  const price = findMonthlyPrice(plan, billingMode);
  if (plan.key === 'free') {
    return 'Free';
  }
  if (!price) {
    return 'Contact sales';
  }
  return `${formatMoney(price.amount, price.currency)}/month`;
}
