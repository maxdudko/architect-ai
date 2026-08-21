'use client';

import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  BillingMode,
  Plan,
  PlanLimit,
  SubscriptionStatus,
  WorkspaceBilling,
} from '@/entities';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  ErrorState,
  Loader,
  Skeleton,
} from '@/shared/components';
import {
  useCreateBillingPortalSessionMutation,
  useCreateCheckoutSessionMutation,
  usePlansQuery,
  useResumePaidSubscriptionMutation,
  useScheduleDowngradeToFreeMutation,
  useWorkspaceBillingQuery,
  useWorkspaceUsageQuery,
} from '../services/workspace.service';
import { billingModeForAiMode, formatMonthlyPrice, isFreePlan } from '../utils/billing';
import { USAGE_METRIC_LABELS, effectivePlanLimit, formatLimitCap } from '../utils/usage';

const SALES_EMAIL = 'sales@architect.ai';

function salesGmailComposeUrl(planName: string): string {
  const subject = encodeURIComponent(`${planName} plan`);
  return `https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=${SALES_EMAIL}&su=${subject}`;
}

export function WorkspaceBillingCard({ workspaceId }: { workspaceId: string }) {
  const billingQuery = useWorkspaceBillingQuery(workspaceId);
  const plansQuery = usePlansQuery();
  const usageQuery = useWorkspaceUsageQuery(workspaceId);
  const checkoutMutation = useCreateCheckoutSessionMutation(workspaceId);
  const portalMutation = useCreateBillingPortalSessionMutation(workspaceId);
  const downgradeMutation = useScheduleDowngradeToFreeMutation(workspaceId);
  const resumeMutation = useResumePaidSubscriptionMutation(workspaceId);

  const aiMode = usageQuery.data?.aiMode ?? 'HOSTED';
  const billingMode = billingModeForAiMode(aiMode);
  const billing = billingQuery.data;
  const isLoading = billingQuery.isLoading || plansQuery.isLoading;
  const isError = billingQuery.isError || plansQuery.isError;
  const actionPending =
    checkoutMutation.isPending || downgradeMutation.isPending || resumeMutation.isPending;

  const onUpgrade = async (planId: string, planName: string) => {
    try {
      const session = await checkoutMutation.mutateAsync(planId);
      window.location.assign(session.url);
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

  const onResume = async () => {
    try {
      await resumeMutation.mutateAsync();
      toast.success('Your paid plan will continue.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to keep the current plan.'));
    }
  };

  const onManageBilling = async () => {
    try {
      const session = await portalMutation.mutateAsync();
      window.location.assign(session.url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to open the billing portal.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}
        {isError ? (
          <ErrorState title="Unable to load billing" description="Refresh the page to try again." />
        ) : null}

        {billing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge>{billing.plan.name}</Badge>
                {billing.status ? (
                  <span className="text-sm text-muted-foreground">
                    {formatStatus(billing.status)}
                    {billing.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                  </span>
                ) : null}
              </div>
              {billing.currentPeriodEnd ? (
                <p className="text-xs text-muted-foreground">
                  Current period ends {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            {billing.hasBillingAccount ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={portalMutation.isPending}
                onClick={() => void onManageBilling()}
              >
                {portalMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                Manage billing
              </Button>
            ) : null}
          </div>
        ) : null}

        {plansQuery.data ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {plansQuery.data.map((plan) => (
              <PlanOfferCard
                key={plan.id}
                plan={plan}
                billing={billing}
                billingMode={billingMode}
                actionPending={actionPending}
                onUpgrade={onUpgrade}
                onDowngradeToFree={onDowngradeToFree}
                onResume={onResume}
              />
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {aiMode === 'BYOK'
            ? 'BYOK is active: AI questions and onboarding guides are unlimited. Plan price stays the same.'
            : 'Connect your own AI provider key to uncap AI questions and onboarding guides. Plan price stays the same.'}
        </p>
      </CardContent>
    </Card>
  );
}

function PlanOfferCard({
  plan,
  billing,
  billingMode,
  actionPending,
  onUpgrade,
  onDowngradeToFree,
  onResume,
}: {
  plan: Plan;
  billing: WorkspaceBilling | undefined;
  billingMode: BillingMode;
  actionPending: boolean;
  onUpgrade: (planId: string, planName: string) => Promise<void>;
  onDowngradeToFree: () => Promise<void>;
  onResume: () => Promise<void>;
}) {
  const hostedSelected = billingMode === 'STANDARD';
  const isCurrentPlan = billing?.plan.id === plan.id;
  const currentIsPaid = Boolean(billing && !isFreePlan(billing.plan));
  const periodEndLabel = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
    : 'the end of the current billing period';

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border p-3 ${isCurrentPlan ? 'border-primary' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{plan.name}</span>
        {isCurrentPlan ? (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Current
          </span>
        ) : null}
      </div>
      {plan.description ? (
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      ) : null}

      <div className="overflow-hidden rounded-md border text-sm">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <span>Compare</span>
          <span className={hostedSelected ? 'text-foreground' : undefined}>Hosted AI</span>
          <span className={!hostedSelected ? 'text-foreground' : undefined}>BYOK</span>
        </div>
        {(plan.limits ?? []).map((limit) => (
          <LimitRow key={limit.metric} limit={limit} hostedSelected={hostedSelected} />
        ))}
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline px-2 py-2 bg-[#29903B]/20">
          <span className="font-bold text-muted-foreground">Price</span>
          <span className="col-span-2 font-semibold">{formatMonthlyPrice(plan, 'STANDARD')}</span>
        </div>
      </div>

      <PlanActionButtons
        plan={plan}
        isCurrentPlan={isCurrentPlan}
        currentIsPaid={currentIsPaid}
        currentPlanName={billing?.plan.name ?? 'your current plan'}
        cancelAtPeriodEnd={billing?.cancelAtPeriodEnd ?? false}
        periodEndLabel={periodEndLabel}
        actionPending={actionPending}
        onUpgrade={onUpgrade}
        onDowngradeToFree={onDowngradeToFree}
        onResume={onResume}
      />
    </div>
  );
}

function PlanActionButtons({
  plan,
  isCurrentPlan,
  currentIsPaid,
  currentPlanName,
  cancelAtPeriodEnd,
  periodEndLabel,
  actionPending,
  onUpgrade,
  onDowngradeToFree,
  onResume,
}: {
  plan: Plan;
  isCurrentPlan: boolean;
  currentIsPaid: boolean;
  currentPlanName: string;
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string;
  actionPending: boolean;
  onUpgrade: (planId: string, planName: string) => Promise<void>;
  onDowngradeToFree: () => Promise<void>;
  onResume: () => Promise<void>;
}) {
  if (plan.isContactSales) {
    return (
      <Button asChild type="button" size="sm" variant="outline" className="mt-auto w-full">
        <a href={salesGmailComposeUrl(plan.name)} target="_blank" rel="noopener noreferrer">
          Contact sales
        </a>
      </Button>
    );
  }

  if (isCurrentPlan) {
    return (
      <div className="mt-auto flex flex-col gap-2">
        <Button type="button" size="sm" className="w-full" variant="outline" disabled>
          Current plan
        </Button>
        {cancelAtPeriodEnd ? (
          <Button
            type="button"
            size="sm"
            className="w-full"
            variant="default"
            disabled={actionPending}
            onClick={() => void onResume()}
          >
            {actionPending ? <Loader className="mr-2 h-4 w-4" /> : null}
            Keep this plan
          </Button>
        ) : null}
      </div>
    );
  }

  if (isFreePlan(plan) && currentIsPaid) {
    if (cancelAtPeriodEnd) {
      return (
        <Button type="button" size="sm" className="mt-auto w-full" variant="outline" disabled>
          Switches {periodEndLabel}
        </Button>
      );
    }

    return (
      <div className="mt-auto w-full">
        <ConfirmationDialog
          title="Switch to Free at period end?"
          description={`You'll keep ${currentPlanName} until ${periodEndLabel}. After that this workspace switches to Free and the paid subscription is canceled.`}
          confirmText="Schedule downgrade"
          trigger={
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant="outline"
              disabled={actionPending}
            >
              {actionPending ? <Loader className="mr-2 h-4 w-4" /> : null}
              Downgrade
            </Button>
          }
          onConfirm={onDowngradeToFree}
        />
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      className="mt-auto w-full"
      variant="default"
      disabled={actionPending}
      onClick={() => void onUpgrade(plan.id, plan.name)}
    >
      {actionPending ? <Loader className="mr-2 h-4 w-4" /> : null}
      Upgrade
    </Button>
  );
}

function LimitRow({ limit, hostedSelected }: { limit: PlanLimit; hostedSelected: boolean }) {
  const hosted = formatLimitCap(
    effectivePlanLimit(limit.maxValue, limit.metric, false),
    limit.period,
  );
  const byok = formatLimitCap(effectivePlanLimit(limit.maxValue, limit.metric, true), limit.period);

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline border-b px-2 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{USAGE_METRIC_LABELS[limit.metric]}</span>
      <span className={hostedSelected ? 'text-foreground' : 'text-muted-foreground'}>{hosted}</span>
      <span className={!hostedSelected ? 'text-foreground' : 'text-muted-foreground'}>{byok}</span>
    </div>
  );
}

function formatStatus(status: SubscriptionStatus | null): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'TRIALING':
      return 'Trialing';
    case 'PAST_DUE':
      return 'Past due';
    case 'CANCELED':
      return 'Canceled';
    case 'UNPAID':
      return 'Unpaid';
    case 'PAUSED':
      return 'Paused';
    case 'INCOMPLETE':
      return 'Incomplete';
    default:
      return '';
  }
}
