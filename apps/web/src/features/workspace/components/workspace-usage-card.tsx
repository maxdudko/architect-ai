'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/shared/components';
import { useWorkspaceUsageQuery } from '../services/workspace.service';
import { formatPlan, formatUsageLimit, USAGE_METRIC_LABELS } from '../utils/usage';

export function WorkspaceUsageCard({ workspaceId }: { workspaceId: string }) {
  const usageQuery = useWorkspaceUsageQuery(workspaceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {usageQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}
        {usageQuery.isError ? (
          <ErrorState title="Unable to load usage" description="Refresh the page to try again." />
        ) : null}
        {usageQuery.data ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current plan: {formatPlan(usageQuery.data.plan)}
            </p>
            <p className="text-xs text-muted-foreground">
              {usageQuery.data.aiMode === 'BYOK'
                ? 'BYOK is active: AI questions and onboarding guides are unlimited. Repository, indexing, and member limits still apply.'
                : 'Hosted AI uses plan limits for questions and guides. Connect your own OpenAI key to uncap those two.'}
            </p>
            <ul className="space-y-3">
              {usageQuery.data.metrics.map((metric) => (
                <li key={metric.metric} className="flex items-center justify-between gap-4 text-sm">
                  <span>{USAGE_METRIC_LABELS[metric.metric]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatUsageLimit(metric)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!usageQuery.isLoading && !usageQuery.isError && !usageQuery.data ? (
          <EmptyState
            title="No usage data"
            description="Usage will appear after workspace activity."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
