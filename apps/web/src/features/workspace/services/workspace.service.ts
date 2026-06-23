import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInvitation,
  createWorkspace,
  listMembers,
  listWorkspaces,
  removeMember,
  updateWorkspace,
} from '@/lib/api';

export const WORKSPACE_QUERY_KEYS = {
  list: ['workspaces'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
};

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.list,
    queryFn: listWorkspaces,
  });
}

export function useMembersQuery(workspaceId: string) {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.members(workspaceId),
    queryFn: () => listMembers(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.list });
    },
  });
}

export function useUpdateWorkspaceMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; plan?: 'FREE' | 'PRO' | 'ENTERPRISE' }) =>
      updateWorkspace(workspaceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.list });
    },
  });
}

export function useCreateInvitationMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (payload: { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }) =>
      createInvitation(workspaceId, payload),
  });
}

export function useRemoveMemberMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(workspaceId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.members(workspaceId) });
    },
  });
}
