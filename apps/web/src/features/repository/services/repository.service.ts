import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RepositoryProvider } from '@/entities';
import { createRepository, deleteRepository, listRepositories, updateRepository } from '@/lib/api';

export const REPOSITORY_QUERY_KEYS = {
  list: (workspaceId: string) => ['workspaces', workspaceId, 'repositories'] as const,
};

export function useRepositoriesQuery(workspaceId: string) {
  return useQuery({
    queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
    queryFn: () => listRepositories(workspaceId),
    enabled: Boolean(workspaceId),
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
    }) => createRepository(workspaceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: REPOSITORY_QUERY_KEYS.list(workspaceId),
      });
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
