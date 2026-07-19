import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CodeSymbolType,
  GithubRepositoriesResponse,
  Repository,
  RepositoryProvider,
} from '@/entities';
import {
  createRepository,
  deleteRepository,
  disconnectGithubConnection,
  getGithubConnectUrl,
  getGithubConnection,
  getRepository,
  listGithubRepositories,
  listRepositories,
  listRepositoryFiles,
  listRepositorySymbols,
  reindexRepository,
  retryRepositoryIndexing,
  updateRepository,
} from '@/lib/api';
import { isRepositoryIndexingActive } from '../utils/repository-status';

export const REPOSITORY_QUERY_KEYS = {
  list: (workspaceId: string) => ['workspaces', workspaceId, 'repositories'] as const,
  detail: (workspaceId: string, repositoryId: string) =>
    ['workspaces', workspaceId, 'repositories', repositoryId] as const,
  files: (workspaceId: string, repositoryId: string) =>
    ['workspaces', workspaceId, 'repositories', repositoryId, 'files'] as const,
  symbols: (workspaceId: string, repositoryId: string, filePath?: string) =>
    ['workspaces', workspaceId, 'repositories', repositoryId, 'symbols', filePath ?? null] as const,
  githubConnection: ['integrations', 'github', 'connection'] as const,
  githubRepositories: (workspaceId: string, cursor?: string) =>
    ['integrations', 'github', 'repositories', workspaceId, cursor ?? null] as const,
};

export function useRepositoriesQuery(workspaceId: string) {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
    queryFn: () => listRepositories(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) => {
      const repositories = query.state.data as Repository[] | undefined;
      const hasPending = repositories?.some((repository) =>
        isRepositoryIndexingActive(repository.status),
      );
      return hasPending ? 2500 : false;
    },
  });
}

export function useRepositoryQuery(workspaceId: string, repositoryId: string) {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.detail(workspaceId, repositoryId),
    queryFn: () => getRepository(workspaceId, repositoryId),
    enabled: Boolean(workspaceId) && Boolean(repositoryId),
  });
}

export function useRepositoryFilesQuery(workspaceId: string, repositoryId: string) {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.files(workspaceId, repositoryId),
    queryFn: () => listRepositoryFiles(workspaceId, repositoryId),
    enabled: Boolean(workspaceId) && Boolean(repositoryId),
  });
}

export function useRepositorySymbolsQuery(
  workspaceId: string,
  repositoryId: string,
  options: { filePath?: string; type?: CodeSymbolType } = {},
) {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.symbols(workspaceId, repositoryId, options.filePath),
    queryFn: () => listRepositorySymbols(workspaceId, repositoryId, options),
    enabled: Boolean(workspaceId) && Boolean(repositoryId),
  });
}

export function useGithubConnectionQuery() {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.githubConnection,
    queryFn: () => getGithubConnection(),
  });
}

export function useGithubRepositoriesQuery(
  workspaceId: string,
  options: {
    enabled: boolean;
    cursor?: string;
  },
) {
  return useQuery<GithubRepositoriesResponse>({
    queryKey: REPOSITORY_QUERY_KEYS.githubRepositories(workspaceId, options.cursor),
    queryFn: () => listGithubRepositories(workspaceId, options.cursor),
    enabled: Boolean(workspaceId) && options.enabled,
  });
}

export function useGithubConnectUrlMutation() {
  return useMutation({
    mutationFn: (workspaceId: string) => getGithubConnectUrl(workspaceId),
  });
}

export function useDisconnectGithubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectGithubConnection(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: REPOSITORY_QUERY_KEYS.githubConnection,
        }),
        queryClient.invalidateQueries({
          queryKey: ['integrations', 'github', 'repositories'],
          exact: false,
        }),
      ]);
    },
  });
}

export function useCreateRepositoryMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      provider: RepositoryProvider;
      externalId: string;
      owner: string;
      name: string;
      fullName: string;
      defaultBranch?: string;
      indexBranch?: string;
    }) => createRepository(workspaceId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['integrations', 'github', 'repositories', workspaceId],
          exact: false,
        }),
      ]);
    },
  });
}

export function useUpdateRepositoryMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      repositoryId,
      defaultBranch,
    }: {
      repositoryId: string;
      defaultBranch: string;
    }) => updateRepository(workspaceId, repositoryId, { defaultBranch }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
      });
    },
  });
}

export function useDeleteRepositoryMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => deleteRepository(workspaceId, repositoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
      });
    },
  });
}

export function useRetryRepositoryIndexingMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { repositoryId: string; branch?: string }) =>
      retryRepositoryIndexing(workspaceId, payload.repositoryId, {
        branch: payload.branch,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
      });
    },
  });
}

export function useReindexRepositoryMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { repositoryId: string; branch?: string }) =>
      reindexRepository(workspaceId, payload.repositoryId, {
        branch: payload.branch,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
      });
    },
  });
}
