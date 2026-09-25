import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './axios';
import { getArchitectureModule, getDependencyEvidence, getDependencyMap } from './architecture';

vi.mock('./axios', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const BASE = '/workspaces/workspace-1/repositories/repo-1/architecture/dependency-map';

describe('architecture api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
  });

  it('reads the dependency map for a repository', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { repositoryId: 'repo-1', state: 'READY' },
    });

    const response = await getDependencyMap('workspace-1', 'repo-1');

    expect(apiClient.get).toHaveBeenCalledWith(BASE);
    expect(response.state).toBe('READY');
  });

  it('passes the module key as a query parameter so folder paths survive', async () => {
    await getArchitectureModule('workspace-1', 'repo-1', 'apps/api/src');

    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/module`, {
      params: { key: 'apps/api/src' },
    });
  });

  it('requests evidence for a directed dependency', async () => {
    await getDependencyEvidence('workspace-1', 'repo-1', 'apps/api', 'packages/shared');

    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/evidence`, {
      params: { from: 'apps/api', to: 'packages/shared' },
    });
  });
});
