'use client';

import Link from 'next/link';
import { CheckCircle2, CircleDot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Plan, PlanIndexingLimit, PlanLimit, WorkspaceBilling } from '@/entities';
import { listPlans } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  useCreateCheckoutSessionMutation,
  useScheduleDowngradeToFreeMutation,
  useWorkspaceBillingQuery,
} from '@/features/workspace/services/workspace.service';
import { formatMonthlyPrice, isFreePlan } from '@/features/workspace/utils/billing';
import {
  INDEXING_RESOURCE_METRIC_LABELS,
  USAGE_METRIC_LABELS,
  effectivePlanLimit,
  formatIndexingResourceCap,
  formatLimitCap,
} from '@/features/workspace/utils/usage';
import { canManageWorkspaceAi } from '@/features/workspace/utils/workspace-permissions';
import { useAuth } from '@/providers/auth-provider';
import { Button, ConfirmationDialog, Loader } from '@/shared/components';

const SALES_EMAIL = 'sales@architect.ai';

function salesGmailComposeUrl(planName: string): string {
  const subject = encodeURIComponent(`${planName} plan`);
  return `https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=${SALES_EMAIL}&su=${subject}`;
}

export function LandingPlansSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { activeWorkspace } = useAuth();
  const workspaceId = isAuthenticated ? (activeWorkspace?.id ?? '') : '';
  const canManageBilling = isAuthenticated && canManageWorkspaceAi(activeWorkspace?.role);
  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });
  const billingQuery = useWorkspaceBillingQuery(workspaceId);
  const checkoutMutation = useCreateCheckoutSessionMutation(workspaceId);
  const downgradeMutation = useScheduleDowngradeToFreeMutation(workspaceId);

  const plans = plansQuery.data ?? [];
  const billing = billingQuery.data;
  const highlightedPlanId = plans.find((plan) => !isFreePlan(plan) && !plan.isContactSales)?.id;
  const actionPending = checkoutMutation.isPending || downgradeMutation.isPending;

  const onUpgrade = async (planId: string, planName: string) => {
    try {
      const session = await checkoutMutation.mutateAsync(planId);
      window.open(session.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Unable to start checkout for ${planName}.`));
    }
  };

  const onDowngradeToFree = async () => {
    try {
      await downgradeMutation.mutateAsync();
      toast.success('Your plan will switch to Free at the end of the current billing period.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to schedule the downgrade to Free.'));
    }
  };

  return (
    <section id="plans" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--landing-accent))]">
            <CircleDot className="size-3" aria-hidden="true" />
            Simple, honest plans
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Start free. Scale when the team does.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Hosted AI is included on every plan. Bring your own model key to uncap AI questions and
            onboarding guides—the plan price stays the same.
          </p>
        </div>

        {plansQuery.isLoading ? (
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-[28rem] animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : null}

        {plansQuery.isError ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Plans could not be loaded. Refresh the page to try again.
          </p>
        ) : null}

        {plans.length > 0 ? (
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <LandingPlanCard
                key={plan.id}
                plan={plan}
                highlighted={plan.id === highlightedPlanId}
                isAuthenticated={isAuthenticated}
                canManageBilling={canManageBilling}
                billing={billing}
                actionPending={actionPending}
                onUpgrade={onUpgrade}
                onDowngradeToFree={onDowngradeToFree}
              />
            ))}
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          BYOK uncaps AI questions and onboarding guides. Limits for repositories, indexing runs,
          workspace members, and indexing resource caps still follow the selected plan.
        </p>
      </div>
    </section>
  );
}

function LandingPlanCard({
  plan,
  highlighted,
  isAuthenticated,
  canManageBilling,
  billing,
  actionPending,
  onUpgrade,
  onDowngradeToFree,
}: {
  plan: Plan;
  highlighted: boolean;
  isAuthenticated: boolean;
  canManageBilling: boolean;
  billing: WorkspaceBilling | undefined;
  actionPending: boolean;
  onUpgrade: (planId: string, planName: string) => Promise<void>;
  onDowngradeToFree: () => Promise<void>;
}) {
  const isCurrentPlan = Boolean(isAuthenticated && billing && billing.plan.id === plan.id);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-6 ${
        highlighted
          ? 'border-[hsl(var(--landing-accent)/.55)] bg-[hsl(var(--landing-accent)/.06)]'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-medium">{plan.name}</h3>
        {isCurrentPlan ? (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Current
          </span>
        ) : highlighted ? (
          <span className="rounded-full border border-[hsl(var(--landing-accent)/.45)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.1em] text-[hsl(var(--landing-accent))]">
            Popular
          </span>
        ) : null}
      </div>
      {plan.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      ) : null}

      <p className="mt-5 text-3xl font-semibold tracking-tight">
        {formatMonthlyPrice(plan, 'STANDARD')}
      </p>

      <div className="mt-6 overflow-hidden rounded-md border text-sm">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <span>Limits</span>
          <span>Hosted AI</span>
          <span>BYOK</span>
        </div>
        {(plan.limits ?? []).map((limit) => (
          <LandingLimitRow key={limit.metric} limit={limit} />
        ))}
        {(plan.indexingLimits ?? []).map((limit) => (
          <LandingIndexingLimitRow key={limit.metric} limit={limit} />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <LandingPlanActions
          plan={plan}
          highlighted={highlighted}
          isAuthenticated={isAuthenticated}
          isCurrentPlan={isCurrentPlan}
          canManageBilling={canManageBilling}
          billing={billing}
          actionPending={actionPending}
          onUpgrade={onUpgrade}
          onDowngradeToFree={onDowngradeToFree}
        />
      </div>
    </div>
  );
}

function landingCtaClass(highlighted: boolean): string {
  return highlighted ? 'h-10 w-full bg-[#29903B] text-white hover:opacity-90' : 'h-10 w-full';
}

function LandingPlanActions({
  plan,
  highlighted,
  isAuthenticated,
  isCurrentPlan,
  canManageBilling,
  billing,
  actionPending,
  onUpgrade,
  onDowngradeToFree,
}: {
  plan: Plan;
  highlighted: boolean;
  isAuthenticated: boolean;
  isCurrentPlan: boolean;
  canManageBilling: boolean;
  billing: WorkspaceBilling | undefined;
  actionPending: boolean;
  onUpgrade: (planId: string, planName: string) => Promise<void>;
  onDowngradeToFree: () => Promise<void>;
}) {
  if (plan.isContactSales) {
    return (
      <Button asChild type="button" variant="outline" className="h-10 w-full">
        <a href={salesGmailComposeUrl(plan.name)} target="_blank" rel="noopener noreferrer">
          Contact sales
        </a>
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        asChild
        variant={highlighted ? 'default' : 'outline'}
        className={landingCtaClass(highlighted)}
      >
        <Link href="/sign-up">{isFreePlan(plan) ? 'Get started' : `Start ${plan.name}`}</Link>
      </Button>
    );
  }

  if (isCurrentPlan || !canManageBilling || !billing) {
    return (
      <Button
        asChild
        variant={highlighted ? 'default' : 'outline'}
        className={landingCtaClass(highlighted)}
      >
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  }

  const currentIsPaid = !isFreePlan(billing.plan);
  const cancelAtPeriodEnd = billing.cancelAtPeriodEnd;
  const periodEndLabel = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
    : 'the end of the current billing period';

  if (isFreePlan(plan) && currentIsPaid) {
    if (cancelAtPeriodEnd) {
      return (
        <Button type="button" variant="outline" className="h-10 w-full" disabled>
          Switches {periodEndLabel}
        </Button>
      );
    }

    return (
      <ConfirmationDialog
        title="Switch to Free at period end?"
        description={`You'll keep ${billing.plan.name} until ${periodEndLabel}. After that this workspace switches to Free and the paid subscription is canceled.`}
        confirmText="Schedule downgrade"
        trigger={
          <Button type="button" variant="outline" className="h-10 w-full" disabled={actionPending}>
            {actionPending ? <Loader className="mr-2 h-4 w-4" /> : null}
            Downgrade
          </Button>
        }
        onConfirm={onDowngradeToFree}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      className="h-10 w-full"
      disabled={actionPending}
      onClick={() => void onUpgrade(plan.id, plan.name)}
    >
      {actionPending ? <Loader className="mr-2 h-4 w-4" /> : null}
      Upgrade
    </Button>
  );
}

function LandingIndexingLimitRow({ limit }: { limit: PlanIndexingLimit }) {
  const cap = formatIndexingResourceCap(limit.metric, limit.maxValue);

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline border-b px-2 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{INDEXING_RESOURCE_METRIC_LABELS[limit.metric]}</span>
      <span>{cap}</span>
      <span>{cap}</span>
    </div>
  );
}

function LandingLimitRow({ limit }: { limit: PlanLimit }) {
  const hosted = formatLimitCap(
    effectivePlanLimit(limit.maxValue, limit.metric, false),
    limit.period,
  );
  const byok = formatLimitCap(effectivePlanLimit(limit.maxValue, limit.metric, true), limit.period);

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline border-b px-2 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{USAGE_METRIC_LABELS[limit.metric]}</span>
      <span>{hosted}</span>
      <span>{byok}</span>
    </div>
  );
}
