import type { WorkspaceAiKeyTestResult, WorkspaceAiSettings } from '@/entities';
import { apiClient } from './axios';

export async function getWorkspaceAiSettings(workspaceId: string): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.get<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings`,
  );
  return data;
}

export async function upsertWorkspaceAiSettings(
  workspaceId: string,
  openaiApiKey: string,
): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.put<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings`,
    { openaiApiKey },
  );
  return data;
}

export async function deleteWorkspaceAiSettings(workspaceId: string): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.delete<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings`,
  );
  return data;
}

export async function testWorkspaceAiKey(
  workspaceId: string,
  openaiApiKey?: string,
): Promise<WorkspaceAiKeyTestResult> {
  const { data } = await apiClient.post<WorkspaceAiKeyTestResult>(
    `/workspaces/${workspaceId}/ai-settings/test`,
    openaiApiKey ? { openaiApiKey } : {},
  );
  return data;
}
