import type {
  GithubBranchesResponse,
  GithubConnection,
  GithubRepositoriesResponse,
} from '@/entities';
import { apiClient } from './axios';

export async function getGithubConnectUrl(workspaceId: string): Promise<{ url: string }> {
  const { data } = await apiClient.get<{ url: string }>('/integrations/github/connect-url', {
    params: { workspaceId },
  });
  return data;
}

export async function getGithubConnection(): Promise<GithubConnection> {
  const { data } = await apiClient.get<GithubConnection>('/integrations/github/connection');
  return data;
}

export async function disconnectGithubConnection(): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete<{ success: boolean }>('/integrations/github/connection');
  return data;
}

export async function listGithubRepositories(
  workspaceId: string,
  cursor?: string,
): Promise<GithubRepositoriesResponse> {
  const { data } = await apiClient.get<GithubRepositoriesResponse>(
    '/integrations/github/repositories',
    {
      params: {
        workspaceId,
        ...(cursor ? { cursor } : {}),
      },
    },
  );
  return data;
}

export async function listGithubRepositoryBranches(
  externalId: string,
  workspaceId: string,
  cursor?: string,
): Promise<GithubBranchesResponse> {
  const { data } = await apiClient.get<GithubBranchesResponse>(
    `/integrations/github/repositories/${encodeURIComponent(externalId)}/branches`,
    {
      params: {
        workspaceId,
        ...(cursor ? { cursor } : {}),
      },
    },
  );
  return data;
}
