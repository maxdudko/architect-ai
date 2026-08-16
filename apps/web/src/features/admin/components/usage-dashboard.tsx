'use client';

import { useEffect, useState } from 'react';
import type { AdminPlanLimit, AdminWorkspaceUsageRow, UsageMetric } from '@/entities';
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
  SearchInput,
  Skeleton,
} from '@/shared/components';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  useAdminPlanLimitsQuery,
  useAdminWorkspaceUsageQuery,
  useUpdateAdminPlanLimitsMutation,
} from '../services/admin-usage.service';

const METRIC_LABELS: Record<UsageMetric, string> = {
  REPOSITORIES: 'Repositories',
  INDEXING_RUNS: 'Indexing runs',
  GUIDE_GENERATIONS: 'Guide generations',
  AI_QUESTIONS: 'AI questions',
  MEMBERS: 'Members',
};

function formatLimit(value: number | null): string {
  return value == null ? 'Unlimited' : String(value);
}

function formatUsage(used: number, limit: number | null): string {
  return `${used} / ${formatLimit(limit)}`;
}

const EMPTY_LIMIT_VALUES: Record<UsageMetric, string> = {
  REPOSITORIES: '',
  INDEXING_RUNS: '',
  GUIDE_GENERATIONS: '',
  AI_QUESTIONS: '',
  MEMBERS: '',
};

function limitsToValues(rows: AdminPlanLimit[]): Record<UsageMetric, string> {
  const next = { ...EMPTY_LIMIT_VALUES };
  for (const row of rows) {
    next[row.metric] = row.maxValue == null ? '' : String(row.maxValue);
  }
  return next;
}

function PlanLimitsForm() {
  const limitsQuery = useAdminPlanLimitsQuery('FREE');
  const updateMutation = useUpdateAdminPlanLimitsMutation('FREE');
  const [edits, setEdits] = useState<Record<UsageMetric, string> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const values =
    edits ?? (limitsQuery.data ? limitsToValues(limitsQuery.data) : EMPTY_LIMIT_VALUES);

  const onSave = async () => {
    if (!limitsQuery.data) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    const limits = limitsQuery.data.map((row: AdminPlanLimit) => {
      const raw = values[row.metric]?.trim();
      return {
        metric: row.metric,
        maxValue: raw === '' ? null : Number(raw),
      };
    });
    if (limits.some((item) => item.maxValue != null && !Number.isInteger(item.maxValue))) {
      setErrorMessage('Limits must be whole numbers, or blank for unlimited.');
      return;
    }
    try {
      const saved = await updateMutation.mutateAsync(limits);
      setEdits(limitsToValues(saved));
      setSuccessMessage('Free plan limits updated.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to update plan limits.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Free plan limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {limitsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
        {limitsQuery.isError ? (
          <ErrorState
            title="Unable to load plan limits"
            description="Something went wrong while fetching Free plan limits."
          />
        ) : null}
        {limitsQuery.data ? (
          <>
            <p className="text-sm text-muted-foreground">
              Leave a field blank for unlimited. Monthly metrics reset at the start of each UTC
              month. BYOK workspaces ignore AI question and onboarding guide caps; repository,
              indexing, and member limits still apply.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {limitsQuery.data.map((row) => (
                <div key={row.metric} className="space-y-1">
                  <label htmlFor={`limit-${row.metric}`} className="text-sm font-medium">
                    {METRIC_LABELS[row.metric]}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({row.period === 'MONTHLY' ? 'monthly' : 'current'})
                    </span>
                  </label>
                  <Input
                    id={`limit-${row.metric}`}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    value={values[row.metric] ?? ''}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...(current ?? values),
                        [row.metric]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
            <Button type="button" disabled={updateMutation.isPending} onClick={() => void onSave()}>
              {updateMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
              Save limits
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkspaceUsageTable() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const usageQuery = useAdminWorkspaceUsageQuery({
    page,
    pageSize,
    search: search || undefined,
  });
  const total = usageQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = usageQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <SearchInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search workspaces"
          />
        </div>
        {usageQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {usageQuery.isError ? (
          <ErrorState
            title="Unable to load workspace usage"
            description="Something went wrong while fetching workspace usage."
          />
        ) : null}
        {!usageQuery.isLoading && !usageQuery.isError && items.length === 0 ? (
          <EmptyState title="No workspaces" description="No matching workspaces were found." />
        ) : null}
        {items.map((workspace: AdminWorkspaceUsageRow) => (
          <div key={workspace.workspaceId} className="space-y-2 border-b py-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{workspace.name}</p>
                <p className="text-sm text-muted-foreground">{workspace.slug}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{workspace.plan}</Badge>
                <Badge variant={workspace.aiMode === 'BYOK' ? 'default' : 'secondary'}>
                  {workspace.aiMode}
                </Badge>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {workspace.metrics.map((metric) => (
                <div key={metric.metric}>
                  <p className="text-muted-foreground">{METRIC_LABELS[metric.metric]}</p>
                  <p className="tabular-nums">{formatUsage(metric.used, metric.limit)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length > 0 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function UsageDashboard() {
  return (
    <div className="space-y-6">
      <PlanLimitsForm />
      <WorkspaceUsageTable />
    </div>
  );
}
