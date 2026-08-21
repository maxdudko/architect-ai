import type { CheckoutSession, Plan, WorkspaceBilling } from '@/entities';
import { apiClient } from './axios';

export async function listPlans(): Promise<Plan[]> {
  const { data } = await apiClient.get<Plan[]>('/plans');
  return data;
}

export async function getWorkspaceBilling(workspaceId: string): Promise<WorkspaceBilling> {
  const { data } = await apiClient.get<WorkspaceBilling>(`/workspaces/${workspaceId}/billing`);
  return data;
}

export async function createCheckoutSession(
  workspaceId: string,
  planId: string,
): Promise<CheckoutSession> {
  const { data } = await apiClient.post<CheckoutSession>(
    `/workspaces/${workspaceId}/billing/checkout`,
    { planId },
  );
  return data;
}

export async function createBillingPortalSession(workspaceId: string): Promise<CheckoutSession> {
  const { data } = await apiClient.post<CheckoutSession>(
    `/workspaces/${workspaceId}/billing/portal`,
  );
  return data;
}
