import type { Repository, RepositoryProvider } from '@/entities';
import { apiClient } from './axios';

export interface CreateRepositoryPayload {
  provider: RepositoryProvider;
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
}

export interface UpdateRepositoryPayload {
  defaultBranch?: string;
}

export async function listRepositories(workspaceId: string): Promise<Repository[]> {
  const { data } = await apiClient.get<Repository[]>(`/workspaces/${workspaceId}/repositories`);
  return data;
}

export async function getRepository(
  workspaceId: string,
  repositoryId: string,
): Promise<Repository> {
  const { data } = await apiClient.get<Repository>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}`,
  );
  return data;
}

export async function createRepository(
  workspaceId: string,
  payload: CreateRepositoryPayload,
): Promise<Repository> {
  const { data } = await apiClient.post<Repository>(
    `/workspaces/${workspaceId}/repositories`,
    payload,
  );
  return data;
}

export async function updateRepository(
  workspaceId: string,
  repositoryId: string,
  payload: UpdateRepositoryPayload,
): Promise<Repository> {
  const { data } = await apiClient.patch<Repository>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}`,
    payload,
  );
  return data;
}

export async function deleteRepository(
  workspaceId: string,
  repositoryId: string,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}`,
  );
  return data;
}
