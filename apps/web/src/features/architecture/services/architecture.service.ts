'use client';

import { useQuery } from '@tanstack/react-query';
import { getArchitectureModule, getDependencyEvidence, getDependencyMap } from '@/lib/api';

export const ARCHITECTURE_QUERY_KEYS = {
  root: (workspaceId: string, repositoryId: string) =>
    ['workspaces', workspaceId, 'repositories', repositoryId, 'architecture'] as const,
  dependencyMap: (workspaceId: string, repositoryId: string) =>
    [...ARCHITECTURE_QUERY_KEYS.root(workspaceId, repositoryId), 'dependency-map'] as const,
  module: (workspaceId: string, repositoryId: string, key: string) =>
    [
      ...ARCHITECTURE_QUERY_KEYS.root(workspaceId, repositoryId),
      'dependency-map',
      'module',
      key,
    ] as const,
  evidence: (workspaceId: string, repositoryId: string, from: string, to: string) =>
    [
      ...ARCHITECTURE_QUERY_KEYS.root(workspaceId, repositoryId),
      'dependency-map',
      'evidence',
      from,
      to,
    ] as const,
};

export function useDependencyMapQuery(workspaceId: string, repositoryId: string) {
  return useQuery({
    queryKey: ARCHITECTURE_QUERY_KEYS.dependencyMap(workspaceId, repositoryId),
    queryFn: () => getDependencyMap(workspaceId, repositoryId),
    enabled: Boolean(workspaceId && repositoryId),
  });
}

export function useArchitectureModuleQuery(
  workspaceId: string,
  repositoryId: string,
  moduleKey: string | null,
) {
  return useQuery({
    queryKey: ARCHITECTURE_QUERY_KEYS.module(workspaceId, repositoryId, moduleKey ?? ''),
    queryFn: () => getArchitectureModule(workspaceId, repositoryId, moduleKey ?? ''),
    enabled: Boolean(workspaceId && repositoryId && moduleKey),
  });
}

export function useDependencyEvidenceQuery(
  workspaceId: string,
  repositoryId: string,
  dependency: { from: string; to: string } | null,
) {
  return useQuery({
    queryKey: ARCHITECTURE_QUERY_KEYS.evidence(
      workspaceId,
      repositoryId,
      dependency?.from ?? '',
      dependency?.to ?? '',
    ),
    queryFn: () =>
      getDependencyEvidence(
        workspaceId,
        repositoryId,
        dependency?.from ?? '',
        dependency?.to ?? '',
      ),
    enabled: Boolean(workspaceId && repositoryId && dependency),
  });
}
