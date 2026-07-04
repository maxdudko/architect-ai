import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './axios';
import { retryRepositoryIndexing } from './repository';

vi.mock('./axios', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('repository api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries indexing for a repository', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id: 'repo-1',
        workspaceId: 'workspace-1',
        provider: 'GITHUB',
        externalId: '123',
        owner: 'acme',
        name: 'platform',
        fullName: 'acme/platform',
        defaultBranch: 'main',
        status: 'PENDING',
        lastIndexedAt: null,
        indexingError: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const response = await retryRepositoryIndexing('workspace-1', 'repo-1');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repo-1/retry',
      {},
    );
    expect(response.status).toBe('PENDING');
  });
});
