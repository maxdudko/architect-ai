import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './axios';
import {
  askArchitectureSearch,
  generateSystemOverview,
  getArchitectureModule,
  getArchitectureSearch,
  getDependencyEvidence,
  getDependencyMap,
  getSystemOverview,
  regenerateSystemOverview,
} from './architecture';

vi.mock('./axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const BASE = '/workspaces/workspace-1/repositories/repo-1/architecture/dependency-map';

describe('architecture api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
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

  it('reads the architecture search thread for the caller', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { repositoryId: 'repo-1', indexingAvailable: false, turns: [] },
    });

    const response = await getArchitectureSearch('workspace-1', 'repo-1');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repo-1/architecture/search',
    );
    expect(response.indexingAvailable).toBe(false);
  });

  it('posts an architecture question and returns the stored answer', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { epistemic: 'OBSERVED', content: 'Features depends on Billing.' },
    });

    const response = await askArchitectureSearch(
      'workspace-1',
      'repo-1',
      'What depends on billing?',
    );

    expect(apiClient.post).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repo-1/architecture/search/messages',
      { content: 'What depends on billing?' },
    );
    expect(response.epistemic).toBe('OBSERVED');
  });

  it('reads the system overview for a repository', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { repositoryId: 'repo-1', generationAllowed: false, overview: null },
    });

    const response = await getSystemOverview('workspace-1', 'repo-1');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repo-1/architecture/overview',
    );
    expect(response.overview).toBeNull();
  });

  it('queues overview generation and regeneration', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'QUEUED' } });

    await generateSystemOverview('workspace-1', 'repo-1');
    await regenerateSystemOverview('workspace-1', 'repo-1');

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      '/workspaces/workspace-1/repositories/repo-1/architecture/overview/generations',
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/workspaces/workspace-1/repositories/repo-1/architecture/overview/generations/regenerate',
    );
  });
});
