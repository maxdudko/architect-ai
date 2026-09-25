import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getArchitectureModule,
  getArchitectureSearch,
  getDependencyEvidence,
  getDependencyMap,
} from '@/lib/api';
import {
  ARCHITECTURE_QUERY_KEYS,
  useArchitectureModuleQuery,
  useArchitectureSearchQuery,
  useDependencyEvidenceQuery,
  useDependencyMapQuery,
} from './architecture.service';

interface QueryOptions {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => unknown;
}

const state = vi.hoisted(() => ({
  queryOptions: undefined as unknown,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    state.queryOptions = options;
    return { data: undefined };
  },
}));

vi.mock('@/lib/api', () => ({
  getDependencyMap: vi.fn(),
  getArchitectureModule: vi.fn(),
  getDependencyEvidence: vi.fn(),
  getArchitectureSearch: vi.fn(),
}));

function lastOptions(): QueryOptions {
  return state.queryOptions as QueryOptions;
}

describe('architecture query keys', () => {
  it('scopes every key under the workspace and repository', () => {
    expect(ARCHITECTURE_QUERY_KEYS.dependencyMap('workspace-1', 'repo-1')).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repo-1',
      'architecture',
      'dependency-map',
    ]);
    expect(ARCHITECTURE_QUERY_KEYS.module('workspace-1', 'repo-1', 'apps/api')).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repo-1',
      'architecture',
      'dependency-map',
      'module',
      'apps/api',
    ]);
    expect(
      ARCHITECTURE_QUERY_KEYS.evidence('workspace-1', 'repo-1', 'apps/api', 'packages/shared'),
    ).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repo-1',
      'architecture',
      'dependency-map',
      'evidence',
      'apps/api',
      'packages/shared',
    ]);
    expect(ARCHITECTURE_QUERY_KEYS.search('workspace-1', 'repo-1')).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repo-1',
      'architecture',
      'search',
    ]);
  });

  it('keys separate modules separately so two selections never share a cache entry', () => {
    expect(ARCHITECTURE_QUERY_KEYS.module('workspace-1', 'repo-1', 'apps/api')).not.toEqual(
      ARCHITECTURE_QUERY_KEYS.module('workspace-1', 'repo-1', 'apps/web'),
    );
  });
});

describe('architecture query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables the dependency map query without a workspace', async () => {
    useDependencyMapQuery('', 'repo-1');

    expect(lastOptions().enabled).toBe(false);
    await lastOptions().queryFn();
    expect(getDependencyMap).toHaveBeenCalledWith('', 'repo-1');
  });

  it('enables the dependency map query once both ids are present', () => {
    useDependencyMapQuery('workspace-1', 'repo-1');

    expect(lastOptions().enabled).toBe(true);
  });

  it('disables the module query until a module is selected', async () => {
    useArchitectureModuleQuery('workspace-1', 'repo-1', null);

    expect(lastOptions().enabled).toBe(false);

    useArchitectureModuleQuery('workspace-1', 'repo-1', 'apps/api');

    expect(lastOptions().enabled).toBe(true);
    await lastOptions().queryFn();
    expect(getArchitectureModule).toHaveBeenCalledWith('workspace-1', 'repo-1', 'apps/api');
  });

  it('disables the evidence query until a dependency is inspected', async () => {
    useDependencyEvidenceQuery('workspace-1', 'repo-1', null);

    expect(lastOptions().enabled).toBe(false);

    useDependencyEvidenceQuery('workspace-1', 'repo-1', {
      from: 'apps/api',
      to: 'packages/shared',
    });

    expect(lastOptions().enabled).toBe(true);
    await lastOptions().queryFn();
    expect(getDependencyEvidence).toHaveBeenCalledWith(
      'workspace-1',
      'repo-1',
      'apps/api',
      'packages/shared',
    );
  });

  it('loads the architecture search thread for the repository', async () => {
    useArchitectureSearchQuery('workspace-1', 'repo-1');

    expect(lastOptions().enabled).toBe(true);
    await lastOptions().queryFn();
    expect(getArchitectureSearch).toHaveBeenCalledWith('workspace-1', 'repo-1');
  });
});
