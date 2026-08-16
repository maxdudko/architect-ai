import type { Workspace, WorkspaceDetails } from '@/entities';
import { apiClient } from './axios';

export interface CreateWorkspacePayload {
  name: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<Workspace[]>('/workspaces');
  return data;
}

export async function createWorkspace(payload: CreateWorkspacePayload): Promise<WorkspaceDetails> {
  const { data } = await apiClient.post<WorkspaceDetails>('/workspaces', payload);
  return data;
}

export async function updateWorkspace(
  workspaceId: string,
  payload: UpdateWorkspacePayload,
): Promise<WorkspaceDetails> {
  const { data } = await apiClient.patch<WorkspaceDetails>(`/workspaces/${workspaceId}`, payload);
  return data;
}

export async function switchWorkspace(workspaceId: string): Promise<{
  accessToken: string;
  activeWorkspace: Workspace;
}> {
  const { data } = await apiClient.post<{
    accessToken: string;
    activeWorkspace: Workspace;
  }>(`/workspaces/${workspaceId}/switch`, {});
  return data;
}
