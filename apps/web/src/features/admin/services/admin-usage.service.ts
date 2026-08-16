import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPlanLimit, UsageMetric, WorkspacePlan } from '@/entities';
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

export function useAdminPlanLimitsQuery(plan: WorkspacePlan) {
  return useQuery({
    queryKey: ['admin', 'plans', plan, 'limits'],
    queryFn: () => getAdminPlanLimits(plan),
  });
}

export function useUpdateAdminPlanLimitsMutation(plan: WorkspacePlan) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limits: Array<{ metric: UsageMetric; maxValue: number | null }>) =>
      updateAdminPlanLimits(plan, limits),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'plans', plan, 'limits'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
    },
  });
}

export type { AdminPlanLimit };
