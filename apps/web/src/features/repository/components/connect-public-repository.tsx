'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import type { GithubRepositorySummary } from '@/entities';
import { Button, Input } from '@/shared/components';
import { ConnectRepositoryDialog } from './connect-repository-dialog';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    return fallback;
  }

  const payload = error.response?.data as
    | { error?: { message?: string | string[] } | string; message?: string | string[] }
    | undefined;

  const fromNested =
    payload?.error && typeof payload.error === 'object'
      ? payload.error.message
      : typeof payload?.error === 'string'
        ? payload.error
        : undefined;
  const message = fromNested ?? payload?.message;
  if (Array.isArray(message)) {
    return message.join(', ') || fallback;
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
}

interface ConnectPublicRepositoryProps {
  workspaceId: string;
  isConnectPending: boolean;
  onResolve: (q: string) => Promise<GithubRepositorySummary>;
  onConnect: (repository: GithubRepositorySummary, branch: string) => Promise<void>;
  onReconnectRequired?: () => void;
}

export function ConnectPublicRepository({
  workspaceId,
  isConnectPending,
  onResolve,
  onConnect,
  onReconnectRequired,
}: ConnectPublicRepositoryProps) {
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<GithubRepositorySummary | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onFind = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setErrorMessage('Paste a GitHub URL or owner/repo.');
      return;
    }

    setIsResolving(true);
    setErrorMessage(null);
    setResolved(null);
    try {
      const repository = await onResolve(trimmed);
      setResolved(repository);
      if (!repository.connectable) {
        toast.message(`${repository.fullName} is already connected.`);
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          'Unable to find that public repository. Check the URL and try again.',
        ),
      );
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border/70 p-3">
      <div>
        <p className="text-sm font-medium">Connect a public repository by link</p>
        <p className="text-xs text-muted-foreground">
          Paste a GitHub URL or owner/repo for any public repository.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="https://github.com/owner/repo or owner/repo"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setResolved(null);
            setErrorMessage(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onFind();
            }
          }}
          disabled={isResolving || isConnectPending}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isResolving || isConnectPending || !query.trim()}
          onClick={() => {
            void onFind();
          }}
        >
          {isResolving ? 'Finding…' : 'Find'}
        </Button>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {resolved ? (
        <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
          <div>
            <p className="font-medium">{resolved.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {resolved.defaultBranch} · Public
              {!resolved.connectable ? ' · Already connected' : null}
            </p>
          </div>
          <ConnectRepositoryDialog
            repository={resolved}
            workspaceId={workspaceId}
            isPending={isConnectPending}
            onReconnectRequired={onReconnectRequired}
            onConnect={async (branch) => {
              await onConnect(resolved, branch);
              setResolved(null);
              setQuery('');
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
