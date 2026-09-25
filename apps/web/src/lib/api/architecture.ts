import type { ArchitectureModuleDetail, DependencyEvidence, DependencyMap } from '@/entities';
import { apiClient } from './axios';

function architectureBasePath(workspaceId: string, repositoryId: string): string {
  return `/workspaces/${workspaceId}/repositories/${repositoryId}/architecture/dependency-map`;
}

export async function getDependencyMap(
  workspaceId: string,
  repositoryId: string,
): Promise<DependencyMap> {
  const { data } = await apiClient.get<DependencyMap>(
    architectureBasePath(workspaceId, repositoryId),
  );
  return data;
}

export async function getArchitectureModule(
  workspaceId: string,
  repositoryId: string,
  key: string,
): Promise<ArchitectureModuleDetail> {
  const { data } = await apiClient.get<ArchitectureModuleDetail>(
    `${architectureBasePath(workspaceId, repositoryId)}/module`,
    { params: { key } },
  );
  return data;
}

export async function getDependencyEvidence(
  workspaceId: string,
  repositoryId: string,
  from: string,
  to: string,
): Promise<DependencyEvidence> {
  const { data } = await apiClient.get<DependencyEvidence>(
    `${architectureBasePath(workspaceId, repositoryId)}/evidence`,
    { params: { from, to } },
  );
  return data;
}
