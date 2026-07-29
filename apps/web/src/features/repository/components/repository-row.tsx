'use client';

import Link from 'next/link';
import type { Repository } from '@/entities';
import { RepositoryActions } from './repository-actions';
import { RepositoryErrorText } from './repository-error-text';
import { RepositoryStatusBadge } from './repository-status-badge';

interface RepositoryRowProps {
  repository: Repository;
  canManage: boolean;
  isRetryPending: boolean;
  isReindexPending: boolean;
  isDeletePending: boolean;
  onRetry: (repositoryId: string, branch?: string) => Promise<void>;
  onReindex: (repositoryId: string, branch?: string) => Promise<void>;
  onDisconnect: (repositoryId: string) => Promise<void>;
  onReconnectRequired?: () => void;
}

function formatLastIndexedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function RepositoryRow({
  repository,
  canManage,
  isRetryPending,
  isReindexPending,
  isDeletePending,
  onRetry,
  onReindex,
  onDisconnect,
  onReconnectRequired,
}: RepositoryRowProps) {
  const lastIndexedLabel = formatLastIndexedAt(repository.lastIndexedAt);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
      <div className="min-w-0">
        <p className="font-medium">
          <Link href={`/repositories/${repository.id}`} className="hover:underline">
            {repository.fullName}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          {repository.provider} · {repository.defaultBranch}
          {lastIndexedLabel ? ` · Last indexed ${lastIndexedLabel}` : ''}
        </p>
        <RepositoryErrorText message={repository.indexingError} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RepositoryStatusBadge status={repository.status} />
        <RepositoryActions
          repository={repository}
          canManage={canManage}
          isRetryPending={isRetryPending}
          isReindexPending={isReindexPending}
          isDeletePending={isDeletePending}
          onRetry={onRetry}
          onReindex={onReindex}
          onDisconnect={onDisconnect}
          onReconnectRequired={onReconnectRequired}
        />
      </div>
    </div>
  );
}
