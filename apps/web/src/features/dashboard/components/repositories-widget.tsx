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
import { RepositoryStatusBadge } from '@/features/repository/components/repository-status-badge';
import { useRepositoriesQuery } from '@/features/repository/services/repository.service';
import {
  formatRepositoryStatusSummary,
  getRecentItems,
  summarizeRepositoryStatuses,
} from '../utils/dashboard';

const MAX_VISIBLE_REPOSITORIES = 5;

interface RepositoriesWidgetProps {
  workspaceId: string;
}

export function RepositoriesWidget({ workspaceId }: RepositoriesWidgetProps) {
  const query = useRepositoriesQuery(workspaceId);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repositories</CardTitle>
          <CardDescription>Connected code repositories and indexing status.</CardDescription>
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
        title="Unable to load repositories"
        description="Something went wrong while fetching your repositories."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const repositories = query.data ?? [];

  if (repositories.length === 0) {
    return (
      <EmptyState
        title="Repositories"
        description="No repositories connected yet. Connect one to start indexing your code."
        action={
          <Button asChild size="sm">
            <Link href="/repositories">Connect a repository</Link>
          </Button>
        }
      />
    );
  }

  const summary = summarizeRepositoryStatuses(repositories);
  const recentRepositories = getRecentItems(repositories, MAX_VISIBLE_REPOSITORIES);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Repositories</CardTitle>
        <CardDescription>{formatRepositoryStatusSummary(summary)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {recentRepositories.map((repository) => (
            <li key={repository.id}>
              <Link
                href={`/repositories/${repository.id}`}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">{repository.fullName}</span>
                <RepositoryStatusBadge status={repository.status} />
              </Link>
            </li>
          ))}
        </ul>
        {repositories.length > MAX_VISIBLE_REPOSITORIES ? (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/repositories">View all {repositories.length} repositories</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
