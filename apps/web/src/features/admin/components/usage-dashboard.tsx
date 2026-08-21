'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { AdminWorkspaceUsageRow, UsageMetric } from '@/entities';
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
  Loader,
  SearchInput,
  Skeleton,
} from '@/shared/components';
import {
  useAdminPlansQuery,
  useAssignWorkspacePlanMutation,
} from '../services/admin-plans.service';
import { useAdminWorkspaceUsageQuery } from '../services/admin-usage.service';

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

function AssignPlanControl({ workspace }: { workspace: AdminWorkspaceUsageRow }) {
  const plansQuery = useAdminPlansQuery();
  const assignMutation = useAssignWorkspacePlanMutation();
  const [planId, setPlanId] = useState(workspace.plan.id);

  const onAssign = async () => {
    if (planId === workspace.plan.id) {
      return;
    }
    try {
      await assignMutation.mutateAsync({ workspaceId: workspace.workspaceId, planId });
      toast.success(`${workspace.name} moved to a new plan.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to assign plan.'));
    }
  };

  const plans = plansQuery.data ?? [];

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={planId}
        disabled={assignMutation.isPending || plansQuery.isLoading}
        onChange={(event) => setPlanId(event.target.value)}
      >
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={assignMutation.isPending || planId === workspace.plan.id}
        onClick={() => void onAssign()}
      >
        {assignMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
        Assign
      </Button>
    </div>
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
                <Badge variant="outline">{workspace.plan.name}</Badge>
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
            <AssignPlanControl workspace={workspace} />
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
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            Plan limits, prices, and BYOK pricing are managed on the Plans page.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/plans">Manage plans</Link>
          </Button>
        </CardContent>
      </Card>
      <WorkspaceUsageTable />
    </div>
  );
}
