'use client';

import type { Repository } from '@/entities';
import { Button, ConfirmationDialog } from '@/shared/components';
import { getRepositoryActionVisibility } from '../utils/repository-status';
import { RepositoryIndexingActionDialog } from './repository-indexing-action-dialog';

interface RepositoryActionsProps {
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

export function RepositoryActions({
  repository,
  canManage,
  isRetryPending,
  isReindexPending,
  isDeletePending,
  onRetry,
  onReindex,
  onDisconnect,
  onReconnectRequired,
}: RepositoryActionsProps) {
  const visibility = getRepositoryActionVisibility(repository.status, canManage);

  return (
    <div className="flex items-center gap-2">
      {visibility.showRetry ? (
        <RepositoryIndexingActionDialog
          triggerLabel="Retry indexing"
          title="Retry indexing"
          description={`Retry indexing for ${repository.fullName}.`}
          workspaceId={repository.workspaceId}
          externalId={repository.externalId}
          defaultBranch={repository.defaultBranch}
          isPending={isRetryPending}
          onSubmit={async (branch) => onRetry(repository.id, branch)}
          onReconnectRequired={onReconnectRequired}
        />
      ) : null}

      {visibility.showReindex ? (
        <RepositoryIndexingActionDialog
          triggerLabel="Reindex"
          title="Reindex repository"
          description={`Start a fresh indexing run for ${repository.fullName}.`}
          workspaceId={repository.workspaceId}
          externalId={repository.externalId}
          defaultBranch={repository.defaultBranch}
          isPending={isReindexPending}
          onSubmit={async (branch) => onReindex(repository.id, branch)}
          onReconnectRequired={onReconnectRequired}
        />
      ) : null}

      {canManage ? (
        <ConfirmationDialog
          title="Disconnect repository?"
          description={`Remove ${repository.fullName} from this workspace.`}
          confirmText="Disconnect"
          destructive
          onConfirm={async () => {
            await onDisconnect(repository.id);
          }}
          trigger={
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletePending || !visibility.allowDisconnect}
              title={
                visibility.allowDisconnect ? undefined : 'Disconnect is disabled during indexing'
              }
            >
              Disconnect
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
