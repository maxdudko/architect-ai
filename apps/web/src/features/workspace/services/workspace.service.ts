import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Membership } from '@/entities';
import {
  createInvitation,
  createWorkspace,
  listInvitations,
  listMembers,
  listWorkspaces,
  removeMember,
  resendInvitation,
  updateMemberRole,
  updateWorkspace,
} from '@/lib/api';

export const WORKSPACE_QUERY_KEYS = {
  list: ['workspaces'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  invitations: (workspaceId: string) => ['workspaces', workspaceId, 'invitations'] as const,
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }) =>
      createInvitation(workspaceId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: WORKSPACE_QUERY_KEYS.invitations(workspaceId),
      });
    },
  });
}

export function useInvitationsQuery(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.invitations(workspaceId),
    queryFn: () => listInvitations(workspaceId),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useResendInvitationMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => resendInvitation(workspaceId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: WORKSPACE_QUERY_KEYS.invitations(workspaceId),
      });
    },
  });
}

export function useUpdateMemberRoleMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Membership['role'] }) =>
      updateMemberRole(workspaceId, memberId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.members(workspaceId) });
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.list });
    },
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
