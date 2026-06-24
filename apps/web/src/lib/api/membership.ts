import type { Membership, WorkspaceRole } from '@/entities';
import { apiClient } from './axios';

export async function listMembers(workspaceId: string): Promise<Membership[]> {
  const { data } = await apiClient.get<Membership[]>(`/workspaces/${workspaceId}/members`);
  return data;
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<Membership> {
  const { data } = await apiClient.patch<Membership>(
    `/workspaces/${workspaceId}/members/${memberId}`,
    { role },
  );
  return data;
}

export async function removeMember(
  workspaceId: string,
  memberId: string,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/workspaces/${workspaceId}/members/${memberId}`,
  );
  return data;
}
