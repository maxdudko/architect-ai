import type {
  AdminPlan,
  AdminPlanPrice,
  BillingMode,
  CreatePlanPayload,
  UpdatePlanPayload,
  UpsertPlanPricePayload,
} from '@/entities';
import { adminApiClient } from './admin-axios';

export async function listAdminPlans(): Promise<AdminPlan[]> {
  const { data } = await adminApiClient.get<AdminPlan[]>('/admin/plans');
  return data;
}

export async function createAdminPlan(payload: CreatePlanPayload): Promise<AdminPlan> {
  const { data } = await adminApiClient.post<AdminPlan>('/admin/plans', payload);
  return data;
}

export async function updateAdminPlan(
  planId: string,
  payload: UpdatePlanPayload,
): Promise<AdminPlan> {
  const { data } = await adminApiClient.patch<AdminPlan>(`/admin/plans/${planId}`, payload);
  return data;
}

export async function upsertAdminPlanPrice(
  planId: string,
  billingMode: BillingMode,
  payload: UpsertPlanPricePayload,
): Promise<AdminPlanPrice> {
  const { data } = await adminApiClient.put<AdminPlanPrice>(
    `/admin/plans/${planId}/prices/${billingMode}`,
    payload,
  );
  return data;
}

export async function assignWorkspacePlan(workspaceId: string, planId: string): Promise<void> {
  await adminApiClient.patch(`/admin/usage/workspaces/${workspaceId}/plan`, { planId });
}
