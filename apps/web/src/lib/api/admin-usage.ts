import type { AdminPaginated, AdminPlanLimit, AdminWorkspaceUsageRow } from '@/entities';
import { adminApiClient } from './admin-axios';

export interface AdminUsageListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function listAdminWorkspaceUsage(
  params: AdminUsageListParams = {},
): Promise<AdminPaginated<AdminWorkspaceUsageRow>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminWorkspaceUsageRow>>(
    '/admin/usage/workspaces',
    { params },
  );
  return data;
}

export async function getAdminPlanLimits(planId: string): Promise<AdminPlanLimit[]> {
  const { data } = await adminApiClient.get<AdminPlanLimit[]>(`/admin/plans/${planId}/limits`);
  return data;
}

export async function updateAdminPlanLimits(
  planId: string,
  limits: Array<{ metric: AdminPlanLimit['metric']; maxValue: number | null }>,
): Promise<AdminPlanLimit[]> {
  const { data } = await adminApiClient.patch<AdminPlanLimit[]>(`/admin/plans/${planId}/limits`, {
    limits,
  });
  return data;
}
