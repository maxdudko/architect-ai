'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { AdminPlan, BillingMode, UsageMetric } from '@/entities';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  Skeleton,
  Textarea,
} from '@/shared/components';
import {
  useAdminPlanLimitsQuery,
  useUpdateAdminPlanLimitsMutation,
} from '../services/admin-usage.service';
import {
  useAdminPlansQuery,
  useCreateAdminPlanMutation,
  useUpdateAdminPlanMutation,
  useUpsertAdminPlanPriceMutation,
} from '../services/admin-plans.service';

const METRICS: UsageMetric[] = [
  'REPOSITORIES',
  'INDEXING_RUNS',
  'GUIDE_GENERATIONS',
  'AI_QUESTIONS',
  'MEMBERS',
];

const METRIC_LABELS: Record<UsageMetric, string> = {
  REPOSITORIES: 'Repositories',
  INDEXING_RUNS: 'Indexing runs',
  GUIDE_GENERATIONS: 'Guide generations',
  AI_QUESTIONS: 'AI questions',
  MEMBERS: 'Members',
};

function centsToInput(amount: number): string {
  return (amount / 100).toFixed(2);
}

function inputToCents(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function findAmount(plan: AdminPlan, billingMode: BillingMode): number {
  return plan.prices.find((price) => price.billingMode === billingMode)?.amount ?? 0;
}

function PlanLimitsEditor({ planId }: { planId: string }) {
  const limitsQuery = useAdminPlanLimitsQuery(planId);
  const updateMutation = useUpdateAdminPlanLimitsMutation(planId);
  const [values, setValues] = useState<Partial<Record<UsageMetric, string>>>({});

  const limitByMetric = new Map((limitsQuery.data ?? []).map((limit) => [limit.metric, limit]));

  const onSave = async () => {
    const limits = METRICS.map((metric) => {
      const raw = values[metric];
      const existing = limitByMetric.get(metric);
      const trimmed = raw === undefined ? String(existing?.maxValue ?? '') : raw.trim();
      const maxValue = trimmed === '' ? null : Number.parseInt(trimmed, 10);
      return { metric, maxValue: Number.isNaN(maxValue as number) ? null : maxValue };
    });
    try {
      await updateMutation.mutateAsync(limits);
      toast.success('Limits updated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update limits.'));
    }
  };

  if (limitsQuery.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (limitsQuery.isError) {
    return <ErrorState title="Unable to load limits" description="Try refreshing the page." />;
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((metric) => {
          const existing = limitByMetric.get(metric);
          const value = values[metric] ?? String(existing?.maxValue ?? '');
          return (
            <label key={metric} className="space-y-1 text-xs">
              <span className="text-muted-foreground">{METRIC_LABELS[metric]}</span>
              <Input
                inputMode="numeric"
                placeholder="Unlimited"
                value={value}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [metric]: event.target.value }))
                }
              />
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={updateMutation.isPending}
        onClick={() => void onSave()}
      >
        {updateMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
        Save limits
      </Button>
    </div>
  );
}

function PlanCard({ plan }: { plan: AdminPlan }) {
  const updatePlanMutation = useUpdateAdminPlanMutation();
  const upsertPriceMutation = useUpsertAdminPlanPriceMutation();

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(plan.sortOrder));
  const [isContactSales, setIsContactSales] = useState(plan.isContactSales);
  const [isActive, setIsActive] = useState(plan.isActive);
  const [standardAmount, setStandardAmount] = useState(centsToInput(findAmount(plan, 'STANDARD')));
  const [byokAmount, setByokAmount] = useState(centsToInput(findAmount(plan, 'BYOK')));

  const onSaveMetadata = async () => {
    try {
      await updatePlanMutation.mutateAsync({
        planId: plan.id,
        payload: {
          name,
          description: description.trim() === '' ? null : description,
          isContactSales,
          isActive,
          sortOrder: Number.parseInt(sortOrder, 10) || 0,
        },
      });
      toast.success(`${name} plan updated.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update plan.'));
    }
  };

  const onSavePrice = async (billingMode: BillingMode, value: string) => {
    const amount = inputToCents(value);
    if (amount === null) {
      toast.error('Enter a valid non-negative price.');
      return;
    }
    try {
      await upsertPriceMutation.mutateAsync({
        planId: plan.id,
        billingMode,
        payload: { amount },
      });
      toast.success(`${billingMode === 'BYOK' ? 'BYOK' : 'Standard'} price updated.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update price.'));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>{plan.name}</CardTitle>
          <Badge variant="outline">{plan.key}</Badge>
          {!plan.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
          {plan.isContactSales ? <Badge variant="secondary">Contact sales</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Sort order</span>
            <Input
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </label>
          <label className="col-span-full space-y-1 text-sm">
            <span className="text-muted-foreground">Description</span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isContactSales}
              onChange={(event) => setIsContactSales(event.target.checked)}
            />
            <span>Contact sales only (no self-serve checkout)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Active (visible to workspaces)</span>
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={updatePlanMutation.isPending}
          onClick={() => void onSaveMetadata()}
        >
          {updatePlanMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
          Save details
        </Button>

        {!plan.isContactSales ? (
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Standard price ($/mo)</span>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={standardAmount}
                  onChange={(event) => setStandardAmount(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={upsertPriceMutation.isPending}
                  onClick={() => void onSavePrice('STANDARD', standardAmount)}
                >
                  Save
                </Button>
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">BYOK price ($/mo)</span>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  value={byokAmount}
                  onChange={(event) => setByokAmount(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={upsertPriceMutation.isPending}
                  onClick={() => void onSavePrice('BYOK', byokAmount)}
                >
                  Save
                </Button>
              </div>
            </label>
          </div>
        ) : null}

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">Usage limits</p>
          <PlanLimitsEditor planId={plan.id} />
        </div>
      </CardContent>
    </Card>
  );
}

function CreatePlanForm() {
  const createMutation = useCreateAdminPlanMutation();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  const onCreate = async () => {
    if (!key.trim() || !name.trim()) {
      toast.error('Key and name are required.');
      return;
    }
    try {
      await createMutation.mutateAsync({ key: key.trim(), name: name.trim() });
      toast.success(`${name} plan created.`);
      setKey('');
      setName('');
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to create plan.'));
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Add plan
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Key (e.g. growth)</span>
            <Input value={key} onChange={(event) => setKey(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" disabled={createMutation.isPending} onClick={() => void onCreate()}>
            {createMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
            Create plan
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlansManager() {
  const plansQuery = useAdminPlansQuery();

  return (
    <div className="space-y-4">
      {plansQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}
      {plansQuery.isError ? (
        <ErrorState title="Unable to load plans" description="Refresh the page to try again." />
      ) : null}
      {!plansQuery.isLoading && !plansQuery.isError && (plansQuery.data ?? []).length === 0 ? (
        <EmptyState title="No plans" description="Create your first plan below." />
      ) : null}
      {(plansQuery.data ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      <CreatePlanForm />
    </div>
  );
}
