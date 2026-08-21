import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPlanLimit, UsageMetric } from '@/entities';
import {
  getAdminPlanLimits,
  listAdminWorkspaceUsage,
  updateAdminPlanLimits,
  type AdminUsageListParams,
} from '@/lib/api';

export function useAdminWorkspaceUsageQuery(params: AdminUsageListParams) {
  return useQuery({
    queryKey: ['admin', 'usage', 'workspaces', params],
    queryFn: () => listAdminWorkspaceUsage(params),
  });
}

export function useAdminPlanLimitsQuery(planId: string) {
  return useQuery({
    queryKey: ['admin', 'plans', planId, 'limits'],
    queryFn: () => getAdminPlanLimits(planId),
    enabled: Boolean(planId),
  });
}

export function useUpdateAdminPlanLimitsMutation(planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limits: Array<{ metric: UsageMetric; maxValue: number | null }>) =>
      updateAdminPlanLimits(planId, limits),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'plans', planId, 'limits'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
    },
  });
}

export type { AdminPlanLimit };
