import type { AiProvider, WorkspaceAiKeyTestResult, WorkspaceAiSettings } from '@/entities';
import { apiClient } from './axios';

export async function getWorkspaceAiSettings(workspaceId: string): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.get<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings`,
  );
  return data;
}

export async function upsertWorkspaceAiCredential(
  workspaceId: string,
  provider: AiProvider,
  apiKey: string,
): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.put<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings/credentials`,
    { provider, apiKey },
  );
  return data;
}

export async function deleteWorkspaceAiCredential(
  workspaceId: string,
  provider: AiProvider,
): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.delete<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings/credentials/${provider}`,
  );
  return data;
}

export async function setActiveAiProvider(
  workspaceId: string,
  provider: AiProvider | null,
): Promise<WorkspaceAiSettings> {
  const { data } = await apiClient.post<WorkspaceAiSettings>(
    `/workspaces/${workspaceId}/ai-settings/active`,
    { provider },
  );
  return data;
}

export async function testWorkspaceAiCredential(
  workspaceId: string,
  provider: AiProvider,
  apiKey?: string,
): Promise<WorkspaceAiKeyTestResult> {
  const { data } = await apiClient.post<WorkspaceAiKeyTestResult>(
    `/workspaces/${workspaceId}/ai-settings/test`,
    apiKey ? { provider, apiKey } : { provider },
  );
  return data;
}
