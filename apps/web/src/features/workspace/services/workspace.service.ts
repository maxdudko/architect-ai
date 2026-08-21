import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiProvider, Membership } from '@/entities';
import {
  createBillingPortalSession,
  createCheckoutSession,
  createInvitation,
  createWorkspace,
  deleteWorkspaceAiCredential,
  getWorkspaceAiSettings,
  getWorkspaceBilling,
  getWorkspaceUsage,
  resumePaidSubscription,
  scheduleDowngradeToFree,
  listInvitations,
  listMembers,
  listPlans,
  listWorkspaces,
  removeMember,
  resendInvitation,
  setActiveAiProvider,
  testWorkspaceAiCredential,
  updateMemberRole,
  updateWorkspace,
  upsertWorkspaceAiCredential,
} from '@/lib/api';

export const WORKSPACE_QUERY_KEYS = {
  list: ['workspaces'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  invitations: (workspaceId: string) => ['workspaces', workspaceId, 'invitations'] as const,
  usage: (workspaceId: string) => ['workspaces', workspaceId, 'usage'] as const,
  aiSettings: (workspaceId: string) => ['workspaces', workspaceId, 'ai-settings'] as const,
  plans: ['plans'] as const,
  billing: (workspaceId: string) => ['workspaces', workspaceId, 'billing'] as const,
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
    mutationFn: (payload: { name?: string }) => updateWorkspace(workspaceId, payload),
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

export function useWorkspaceUsageQuery(workspaceId: string) {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.usage(workspaceId),
    queryFn: () => getWorkspaceUsage(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useWorkspaceAiSettingsQuery(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.aiSettings(workspaceId),
    queryFn: () => getWorkspaceAiSettings(workspaceId),
    enabled: Boolean(workspaceId) && enabled,
  });
}

export function useUpsertWorkspaceAiCredentialMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: AiProvider; apiKey: string }) =>
      upsertWorkspaceAiCredential(workspaceId, provider, apiKey),
    onSuccess: async (settings) => {
      queryClient.setQueryData(WORKSPACE_QUERY_KEYS.aiSettings(workspaceId), settings);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.aiSettings(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.usage(workspaceId),
        }),
      ]);
    },
  });
}

export function useDeleteWorkspaceAiCredentialMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProvider) => deleteWorkspaceAiCredential(workspaceId, provider),
    onSuccess: async (settings) => {
      queryClient.setQueryData(WORKSPACE_QUERY_KEYS.aiSettings(workspaceId), settings);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.aiSettings(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.usage(workspaceId),
        }),
      ]);
    },
  });
}

export function useSetActiveAiProviderMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProvider | null) => setActiveAiProvider(workspaceId, provider),
    onSuccess: async (settings) => {
      queryClient.setQueryData(WORKSPACE_QUERY_KEYS.aiSettings(workspaceId), settings);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.aiSettings(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: WORKSPACE_QUERY_KEYS.usage(workspaceId),
        }),
      ]);
    },
  });
}

export function useTestWorkspaceAiCredentialMutation(workspaceId: string) {
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: AiProvider; apiKey?: string }) =>
      testWorkspaceAiCredential(workspaceId, provider, apiKey),
  });
}

export function usePlansQuery() {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.plans,
    queryFn: listPlans,
  });
}

export function useWorkspaceBillingQuery(workspaceId: string) {
  return useQuery({
    queryKey: WORKSPACE_QUERY_KEYS.billing(workspaceId),
    queryFn: () => getWorkspaceBilling(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateCheckoutSessionMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (planId: string) => createCheckoutSession(workspaceId, planId),
  });
}

export function useCreateBillingPortalSessionMutation(workspaceId: string) {
  return useMutation({
    mutationFn: () => createBillingPortalSession(workspaceId),
  });
}

export function useScheduleDowngradeToFreeMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => scheduleDowngradeToFree(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.billing(workspaceId) });
    },
  });
}

export function useResumePaidSubscriptionMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumePaidSubscription(workspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEYS.billing(workspaceId) });
    },
  });
}
