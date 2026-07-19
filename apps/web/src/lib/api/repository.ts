import type {
  CodeSymbol,
  CodeSymbolType,
  Repository,
  RepositoryFile,
  RepositoryProvider,
} from '@/entities';
import { apiClient } from './axios';

export interface CreateRepositoryPayload {
  provider: RepositoryProvider;
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
  indexBranch?: string;
}

export interface UpdateRepositoryPayload {
  defaultBranch?: string;
}

export interface RetryRepositoryIndexingPayload {
  branch?: string;
}

export interface ListRepositoryFilesParams {
  pathPrefix?: string;
}

export interface ListRepositorySymbolsParams {
  filePath?: string;
  type?: CodeSymbolType;
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

export async function listRepositoryFiles(
  workspaceId: string,
  repositoryId: string,
  params: ListRepositoryFilesParams = {},
): Promise<RepositoryFile[]> {
  const { data } = await apiClient.get<RepositoryFile[]>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}/files`,
    { params },
  );
  return data;
}

export async function listRepositorySymbols(
  workspaceId: string,
  repositoryId: string,
  params: ListRepositorySymbolsParams = {},
): Promise<CodeSymbol[]> {
  const { data } = await apiClient.get<CodeSymbol[]>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}/symbols`,
    { params },
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

export async function retryRepositoryIndexing(
  workspaceId: string,
  repositoryId: string,
  payload: RetryRepositoryIndexingPayload = {},
): Promise<Repository> {
  const { data } = await apiClient.post<Repository>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}/retry`,
    payload,
  );
  return data;
}

export async function reindexRepository(
  workspaceId: string,
  repositoryId: string,
  payload: RetryRepositoryIndexingPayload = {},
): Promise<Repository> {
  const { data } = await apiClient.post<Repository>(
    `/workspaces/${workspaceId}/repositories/${repositoryId}/reindex`,
    payload,
  );
  return data;
}
