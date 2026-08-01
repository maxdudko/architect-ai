'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
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
import { useRepositoriesQuery } from '@/features/repository/services/repository.service';
import { ONBOARDING_GUIDE_QUERY_KEYS } from '@/features/onboarding/hooks/use-onboarding-guides';
import { listOnboardingGuides } from '@/lib/api';
import {
  formatGuideCountLabel,
  formatGuideCoverageSummary,
  getRecentItems,
  summarizeGuideCoverage,
} from '../utils/dashboard';

const MAX_VISIBLE_REPOSITORIES = 5;

interface GuidesWidgetProps {
  workspaceId: string;
}

export function GuidesWidget({ workspaceId }: GuidesWidgetProps) {
  const repositoriesQuery = useRepositoriesQuery(workspaceId);
  const readyRepositories =
    repositoriesQuery.data?.filter((repository) => repository.status === 'READY') ?? [];
  const guideQueries = useQueries({
    queries: readyRepositories.map((repository) => ({
      queryKey: ONBOARDING_GUIDE_QUERY_KEYS.list(workspaceId, repository.id),
      queryFn: () => listOnboardingGuides(workspaceId, repository.id),
      enabled: Boolean(workspaceId && repository.id),
    })),
  });

  if (repositoriesQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Living Guides</CardTitle>
          <CardDescription>Onboarding guides for indexed repositories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (repositoriesQuery.isError) {
    return (
      <ErrorState
        title="Unable to load living guides"
        description="Something went wrong while fetching repository guide coverage."
        action={
          <Button variant="outline" size="sm" onClick={() => void repositoriesQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (readyRepositories.length === 0) {
    return (
      <EmptyState
        title="Living Guides"
        description="Guides appear after a repository finishes indexing successfully."
        action={
          <Button asChild size="sm">
            <Link href="/repositories">View repositories</Link>
          </Button>
        }
      />
    );
  }

  const guideEntries = readyRepositories.map((repository, index) => ({
    repository,
    guideCount: guideQueries[index]?.data?.total ?? 0,
    isLoading: guideQueries[index]?.isLoading ?? false,
    isError: guideQueries[index]?.isError ?? false,
  }));
  const guidesLoading = guideEntries.some((entry) => entry.isLoading);
  const guidesFailed = guideEntries.every((entry) => entry.isError);

  if (guidesLoading && guideEntries.every((entry) => entry.isLoading)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Living Guides</CardTitle>
          <CardDescription>Onboarding guides for indexed repositories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (guidesFailed) {
    return (
      <ErrorState
        title="Unable to load living guides"
        description="Something went wrong while fetching guide counts."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              for (const query of guideQueries) {
                void query.refetch();
              }
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  const loadedEntries = guideEntries.filter((entry) => !entry.isError);
  const summary = summarizeGuideCoverage(
    loadedEntries.map((entry) => ({ guideCount: entry.guideCount })),
  );
  const recentEntries = getRecentItems(
    loadedEntries.map((entry) => ({
      ...entry,
      updatedAt: entry.repository.updatedAt,
    })),
    MAX_VISIBLE_REPOSITORIES,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Living Guides</CardTitle>
        <CardDescription>{formatGuideCoverageSummary(summary)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {recentEntries.map((entry) => (
            <li key={entry.repository.id}>
              <Link
                href={`/repositories/${entry.repository.id}/guides`}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">{entry.repository.fullName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.isLoading ? 'Loading…' : formatGuideCountLabel(entry.guideCount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {loadedEntries.length > MAX_VISIBLE_REPOSITORIES ? (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/repositories">View all {loadedEntries.length} ready repositories</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
