'use client';

import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/shared/components';
import { useWorkspaceUsageQuery } from '@/features/workspace/services/workspace.service';
import {
  formatUsageLimit,
  formatUsageSummary,
  USAGE_METRIC_LABELS,
} from '@/features/workspace/utils/usage';

interface UsageWidgetProps {
  workspaceId: string;
}

export function UsageWidget({ workspaceId }: UsageWidgetProps) {
  const query = useWorkspaceUsageQuery(workspaceId);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
          <CardDescription>Plan limits for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load usage"
        description="Something went wrong while fetching workspace usage."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const usage = query.data;
  if (!usage) {
    return (
      <EmptyState
        title="Usage"
        description="Usage will appear after workspace activity."
        action={
          <Button asChild size="sm">
            <Link href="/workspace/settings">Open settings</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage</CardTitle>
        <CardDescription>{formatUsageSummary(usage.plan, usage.aiMode)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {usage.metrics.map((metric) => (
            <li
              key={metric.metric}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="truncate text-sm font-medium">
                {USAGE_METRIC_LABELS[metric.metric]}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatUsageLimit(metric)}
              </span>
            </li>
          ))}
        </ul>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/workspace/settings">Manage usage and AI provider</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
