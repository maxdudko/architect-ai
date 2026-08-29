'use client';

import Link from 'next/link';
import { CircleDot } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Plan, PlanIndexingLimit, PlanLimit } from '@/entities';
import { listPlans } from '@/lib/api';
import { formatMonthlyPrice, isFreePlan } from '@/features/workspace/utils/billing';
import {
  INDEXING_RESOURCE_METRIC_LABELS,
  USAGE_METRIC_LABELS,
  effectivePlanLimit,
  formatIndexingResourceCap,
  formatLimitCap,
} from '@/features/workspace/utils/usage';

const SALES_EMAIL = 'sales@architect.ai';

function salesGmailComposeUrl(planName: string): string {
  const subject = encodeURIComponent(`${planName} plan`);
  return `https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=${SALES_EMAIL}&su=${subject}`;
}

export function LandingPlansSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const plans = plansQuery.data ?? [];
  const highlightedPlanId = plans.find((plan) => !isFreePlan(plan) && !plan.isContactSales)?.id;

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
}: {
  plan: Plan;
  highlighted: boolean;
  isAuthenticated: boolean;
}) {
  const ctaHref = isAuthenticated ? '/dashboard' : '/sign-up';

  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-6 ${
        highlighted
          ? 'border-[hsl(var(--landing-accent)/.55)] bg-[hsl(var(--landing-accent)/.06)]'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{plan.name}</h3>
        {highlighted ? (
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
        {plan.isContactSales ? (
          <a
            href={salesGmailComposeUrl(plan.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Contact sales
          </a>
        ) : (
          <Link
            href={ctaHref}
            className={`inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 ${
              highlighted
                ? 'bg-[#29903B] text-white'
                : 'border border-border bg-background hover:bg-accent'
            }`}
          >
            {isAuthenticated
              ? 'Go to dashboard'
              : isFreePlan(plan)
                ? 'Get started'
                : `Start ${plan.name}`}
          </Link>
        )}
      </div>
    </div>
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
