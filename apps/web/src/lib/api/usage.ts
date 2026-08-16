import type { WorkspaceUsage } from '@/entities';
import { apiClient } from './axios';

export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const { data } = await apiClient.get<WorkspaceUsage>(`/workspaces/${workspaceId}/usage`);
  return data;
}
