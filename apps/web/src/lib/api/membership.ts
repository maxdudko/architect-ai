import type { Membership } from '@/entities';
import { apiClient } from './axios';

export async function listMembers(workspaceId: string): Promise<Membership[]> {
  const { data } = await apiClient.get<Membership[]>(`/workspaces/${workspaceId}/members`);
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
