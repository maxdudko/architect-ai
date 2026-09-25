'use client';

import { useQuery } from '@tanstack/react-query';
import type { SystemOverview } from '@/entities';
import {
  getArchitectureModule,
  getArchitectureSearch,
  getDependencyEvidence,
  getDependencyMap,
  getSystemOverview,
} from '@/lib/api';

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
  search: (workspaceId: string, repositoryId: string) =>
    [...ARCHITECTURE_QUERY_KEYS.root(workspaceId, repositoryId), 'search'] as const,
  overview: (workspaceId: string, repositoryId: string) =>
    [...ARCHITECTURE_QUERY_KEYS.root(workspaceId, repositoryId), 'overview'] as const,
};

const OVERVIEW_POLL_MS = 2_000;
const OVERVIEW_MAX_POLL_AGE_MS = 15 * 60 * 1000;

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

export function useArchitectureSearchQuery(workspaceId: string, repositoryId: string) {
  return useQuery({
    queryKey: ARCHITECTURE_QUERY_KEYS.search(workspaceId, repositoryId),
    queryFn: () => getArchitectureSearch(workspaceId, repositoryId),
    enabled: Boolean(workspaceId && repositoryId),
  });
}

export function useSystemOverviewQuery(workspaceId: string, repositoryId: string) {
  return useQuery({
    queryKey: ARCHITECTURE_QUERY_KEYS.overview(workspaceId, repositoryId),
    queryFn: () => getSystemOverview(workspaceId, repositoryId),
    enabled: Boolean(workspaceId && repositoryId),
    refetchInterval: (currentQuery) => {
      const overview = currentQuery.state.data as SystemOverview | undefined;
      const status = overview?.run?.status;
      if (status !== 'QUEUED' && status !== 'RUNNING') {
        return false;
      }
      const createdAt = Date.parse(overview?.run?.createdAt ?? '');
      if (Number.isFinite(createdAt) && Date.now() - createdAt > OVERVIEW_MAX_POLL_AGE_MS) {
        return false;
      }
      return OVERVIEW_POLL_MS;
    },
  });
}
