'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuth } from '@/providers/auth-provider';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@/shared/components';
import {
  useCreateRepositoryMutation,
  useDeleteRepositoryMutation,
  useDisconnectGithubMutation,
  useGithubConnectionQuery,
  useGithubConnectUrlMutation,
  useGithubRepositoriesQuery,
  useReindexRepositoryMutation,
  useRepositoriesQuery,
  useResolveGithubRepositoryMutation,
  useRetryRepositoryIndexingMutation,
} from '../services/repository.service';
import { canManageRepositories } from '../utils/repository-permissions';
import { RepositoryRow } from './repository-row';
import { ConnectRepositoryDialog } from './connect-repository-dialog';
import { ConnectPublicRepository } from './connect-public-repository';

const GITHUB_RECONNECT_REQUIRED_CODE = 'GITHUB_RECONNECT_REQUIRED';

function isGithubReconnectRequired(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  const payload = error.response?.data as
    | { error?: { code?: string; message?: string } | string }
    | undefined;
  if (!payload || !payload.error || typeof payload.error === 'string') {
    return false;
  }

  return payload.error.code === GITHUB_RECONNECT_REQUIRED_CODE;
}

export function RepositoriesList() {
  const { activeWorkspace } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = activeWorkspace?.id ?? '';
  const query = useRepositoriesQuery(workspaceId);
  const githubConnectionQuery = useGithubConnectionQuery();
  const connectUrlMutation = useGithubConnectUrlMutation();
  const disconnectGithubMutation = useDisconnectGithubMutation();
  const refetchGithubConnection = githubConnectionQuery.refetch;
  const createMutation = useCreateRepositoryMutation(workspaceId);
  const resolveGithubMutation = useResolveGithubRepositoryMutation(workspaceId);
  const deleteMutation = useDeleteRepositoryMutation(workspaceId);
  const retryMutation = useRetryRepositoryIndexingMutation(workspaceId);
  const reindexMutation = useReindexRepositoryMutation(workspaceId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const canManage = canManageRepositories(activeWorkspace?.role);

  useEffect(() => {
    const oauthStatus = searchParams.get('github_oauth');
    if (!oauthStatus) {
      return;
    }
    const oauthReason = searchParams.get('reason') ?? '';

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('github_oauth');
    nextParams.delete('reason');
    nextParams.delete('workspaceId');
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    window.history.replaceState(null, '', nextUrl);

    if (oauthStatus === 'success') {
      toast.success('GitHub account connected successfully.');
    } else if (oauthStatus === 'error') {
      toast.error(oauthReason ? `GitHub OAuth failed: ${oauthReason}` : 'GitHub OAuth failed.');
    }
  }, [pathname, searchParams]);

  const githubReposQuery = useGithubRepositoriesQuery(workspaceId, {
    enabled: Boolean(workspaceId) && githubConnectionQuery.data?.connected === true,
    cursor,
  });

  const filteredGithubRepos = useMemo(
    () =>
      githubReposQuery.data?.repositories.filter((repository) =>
        repository.fullName.toLowerCase().includes(repoSearch.trim().toLowerCase()),
      ) ?? [],
    [githubReposQuery.data?.repositories, repoSearch],
  );
  const reconnectRequired =
    Boolean(githubReposQuery.error) && isGithubReconnectRequired(githubReposQuery.error);
  const githubReconnectMessage = reconnectRequired
    ? 'GitHub authorization expired. Please reconnect GitHub.'
    : null;
  const visibleErrorMessage = errorMessage ?? githubReconnectMessage;

  const onConnectGithub = async () => {
    if (!workspaceId) {
      return;
    }
    setErrorMessage(null);
    try {
      const { url } = await connectUrlMutation.mutateAsync(workspaceId);
      window.location.assign(url);
    } catch {
      setErrorMessage('Unable to start GitHub OAuth flow. Please try again.');
    }
  };

  useEffect(() => {
    if (!reconnectRequired) {
      return;
    }

    toast.error('GitHub authorization expired. Please reconnect GitHub.');
    void refetchGithubConnection();
  }, [reconnectRequired, refetchGithubConnection]);

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active workspace</CardTitle>
          <CardDescription>Select a workspace to manage repositories.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect GitHub</CardTitle>
            <CardDescription>
              Connect your GitHub account to browse accessible repositories, including private
              repos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  void onConnectGithub();
                }}
                disabled={connectUrlMutation.isPending}
              >
                {githubConnectionQuery.data?.connected ? 'Reconnect GitHub' : 'Connect GitHub'}
              </Button>
              {githubConnectionQuery.data?.connected ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected as {githubConnectionQuery.data.login}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disconnectGithubMutation.isPending}
                    onClick={async () => {
                      await disconnectGithubMutation.mutateAsync();
                      toast.success('GitHub account disconnected.');
                    }}
                  >
                    Disconnect GitHub
                  </Button>
                </>
              ) : null}
            </div>

            {githubConnectionQuery.data?.connected ? (
              <div className="space-y-3">
                <ConnectPublicRepository
                  workspaceId={workspaceId}
                  isConnectPending={createMutation.isPending}
                  onResolve={async (q) => resolveGithubMutation.mutateAsync(q)}
                  onReconnectRequired={() => {
                    setErrorMessage('GitHub authorization expired. Please reconnect GitHub.');
                    toast.error('GitHub authorization expired. Please reconnect GitHub.');
                    void githubConnectionQuery.refetch();
                  }}
                  onConnect={async (repository, branch) => {
                    setErrorMessage(null);
                    try {
                      await createMutation.mutateAsync({
                        provider: 'GITHUB',
                        externalId: repository.id,
                        owner: repository.owner,
                        name: repository.name,
                        fullName: repository.fullName,
                        defaultBranch: branch,
                        indexBranch: branch,
                      });
                      toast.success(`Connected ${repository.fullName}. Indexing started.`);
                    } catch (error) {
                      if (isGithubReconnectRequired(error)) {
                        setErrorMessage('GitHub authorization expired. Please reconnect GitHub.');
                        toast.error('GitHub authorization expired. Please reconnect GitHub.');
                        void githubConnectionQuery.refetch();
                        throw error;
                      }
                      const message = getApiErrorMessage(
                        error,
                        'Unable to connect selected repository. It may already be linked.',
                      );
                      setErrorMessage(message);
                      toast.error(message);
                      throw error;
                    }
                  }}
                />
                <Input
                  placeholder="Search repositories by owner/name"
                  value={repoSearch}
                  onChange={(event) => setRepoSearch(event.target.value)}
                />
                {githubReposQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
                {!githubReposQuery.isLoading && githubReposQuery.isError && !reconnectRequired ? (
                  <p className="text-sm text-destructive">
                    {getApiErrorMessage(
                      githubReposQuery.error,
                      'Unable to load GitHub repositories. Try reconnecting GitHub.',
                    )}
                  </p>
                ) : null}
                {!githubReposQuery.isLoading &&
                !githubReposQuery.isError &&
                filteredGithubRepos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {repoSearch.trim()
                      ? 'No repositories available for this filter.'
                      : 'GitHub returned no repositories for this account.'}
                  </p>
                ) : null}
                <div className="space-y-2">
                  {filteredGithubRepos.map((repository) => (
                    <div
                      key={repository.id}
                      className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{repository.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {repository.defaultBranch} · {repository.isPrivate ? 'Private' : 'Public'}
                        </p>
                      </div>
                      <ConnectRepositoryDialog
                        repository={repository}
                        workspaceId={workspaceId}
                        isPending={createMutation.isPending}
                        onReconnectRequired={() => {
                          setErrorMessage('GitHub authorization expired. Please reconnect GitHub.');
                          toast.error('GitHub authorization expired. Please reconnect GitHub.');
                          void githubConnectionQuery.refetch();
                        }}
                        onConnect={async (branch) => {
                          setErrorMessage(null);
                          try {
                            await createMutation.mutateAsync({
                              provider: 'GITHUB',
                              externalId: repository.id,
                              owner: repository.owner,
                              name: repository.name,
                              fullName: repository.fullName,
                              defaultBranch: branch,
                              indexBranch: branch,
                            });
                            toast.success(`Connected ${repository.fullName}. Indexing started.`);
                          } catch (error) {
                            if (isGithubReconnectRequired(error)) {
                              setErrorMessage(
                                'GitHub authorization expired. Please reconnect GitHub.',
                              );
                              toast.error('GitHub authorization expired. Please reconnect GitHub.');
                              void githubConnectionQuery.refetch();
                              throw error;
                            }
                            const message = getApiErrorMessage(
                              error,
                              'Unable to connect selected repository. It may already be linked.',
                            );
                            setErrorMessage(message);
                            toast.error(message);
                            throw error;
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                {githubReposQuery.data?.nextCursor ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCursor(githubReposQuery.data?.nextCursor ?? undefined)}
                  >
                    Load more
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect GitHub to browse repositories.
              </p>
            )}

            {visibleErrorMessage ? (
              <p className="text-sm text-destructive">{visibleErrorMessage}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected Repositories</CardTitle>
          <CardDescription>
            Repositories are scoped to the active workspace ({activeWorkspace?.name}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? <Skeleton className="h-16 w-full" /> : null}
          {!query.isLoading && !query.data?.length ? (
            <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
          ) : null}
          {query.data?.map((repository) => (
            <RepositoryRow
              key={repository.id}
              repository={repository}
              canManage={canManage}
              isRetryPending={retryMutation.isPending}
              isReindexPending={reindexMutation.isPending}
              isDeletePending={deleteMutation.isPending}
              onReconnectRequired={() => {
                toast.error('GitHub authorization expired. Please reconnect GitHub.');
                void githubConnectionQuery.refetch();
              }}
              onRetry={async (repositoryId, branch) => {
                try {
                  await retryMutation.mutateAsync({ repositoryId, branch });
                  toast.success('Repository indexing retry started.');
                } catch (error) {
                  if (isGithubReconnectRequired(error)) {
                    toast.error('GitHub authorization expired. Please reconnect GitHub.');
                    return;
                  }
                  toast.error(
                    getApiErrorMessage(error, 'Unable to retry indexing for this repository.'),
                  );
                }
              }}
              onReindex={async (repositoryId, branch) => {
                try {
                  await reindexMutation.mutateAsync({ repositoryId, branch });
                  toast.success('Repository reindex started.');
                } catch (error) {
                  if (isGithubReconnectRequired(error)) {
                    toast.error('GitHub authorization expired. Please reconnect GitHub.');
                    return;
                  }
                  toast.error(getApiErrorMessage(error, 'Unable to start repository reindex.'));
                }
              }}
              onDisconnect={async (repositoryId) => {
                try {
                  await deleteMutation.mutateAsync(repositoryId);
                  toast.success('Repository disconnected.');
                } catch {
                  toast.error('Unable to disconnect repository.');
                }
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
