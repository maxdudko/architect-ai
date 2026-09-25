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
import { useRepositoriesQuery } from '@/features/repository/services/repository.service';
import { getRecentItems } from '../utils/dashboard';

const MAX_VISIBLE_REPOSITORIES = 5;

interface ArchitectureWidgetProps {
  workspaceId: string;
}

export function ArchitectureWidget({ workspaceId }: ArchitectureWidgetProps) {
  const repositoriesQuery = useRepositoriesQuery(workspaceId);

  if (repositoriesQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Architecture Explorer</CardTitle>
          <CardDescription>Module dependencies for indexed repositories.</CardDescription>
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
        title="Unable to load architecture"
        description="Something went wrong while fetching indexed repositories."
        action={
          <Button variant="outline" size="sm" onClick={() => void repositoriesQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const readyRepositories =
    repositoriesQuery.data?.filter((repository) => repository.status === 'READY') ?? [];

  if (readyRepositories.length === 0) {
    return (
      <EmptyState
        title="Architecture Explorer"
        description="Dependency maps appear after a repository finishes indexing successfully."
        action={
          <Button asChild size="sm">
            <Link href="/repositories">View repositories</Link>
          </Button>
        }
      />
    );
  }

  const recentRepositories = getRecentItems(readyRepositories, MAX_VISIBLE_REPOSITORIES);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Architecture Explorer</CardTitle>
        <CardDescription>
          Explore how the modules of an indexed repository depend on each other.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {recentRepositories.map((repository) => (
            <li key={repository.id}>
              <Link
                href={`/repositories/${repository.id}/architecture`}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">{repository.fullName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Dependency map</span>
              </Link>
            </li>
          ))}
        </ul>
        {readyRepositories.length > MAX_VISIBLE_REPOSITORIES ? (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/repositories">View all {readyRepositories.length} ready repositories</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
