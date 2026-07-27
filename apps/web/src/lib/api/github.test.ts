import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './axios';
import {
  disconnectGithubConnection,
  getGithubConnectUrl,
  getGithubConnection,
  listGithubRepositories,
  listGithubRepositoryBranches,
} from './github';

vi.mock('./axios', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('github api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests connect url for a workspace', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize' },
    });

    const response = await getGithubConnectUrl('workspace-1');

    expect(apiClient.get).toHaveBeenCalledWith('/integrations/github/connect-url', {
      params: { workspaceId: 'workspace-1' },
    });
    expect(response.url).toContain('github.com');
  });

  it('fetches github connection status', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { connected: true, login: 'octocat' },
    });

    const response = await getGithubConnection();

    expect(apiClient.get).toHaveBeenCalledWith('/integrations/github/connection');
    expect(response.connected).toBe(true);
  });

  it('fetches paged github repositories', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        repositories: [],
        nextCursor: 'cursor-2',
      },
    });

    const response = await listGithubRepositories('workspace-1', 'cursor-1');

    expect(apiClient.get).toHaveBeenCalledWith('/integrations/github/repositories', {
      params: {
        workspaceId: 'workspace-1',
        cursor: 'cursor-1',
      },
    });
    expect(response.nextCursor).toBe('cursor-2');
  });

  it('fetches github repository branches', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        branches: [{ name: 'main', isProtected: true }],
        defaultBranch: 'main',
        nextCursor: null,
      },
    });

    const response = await listGithubRepositoryBranches('100', 'workspace-1');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/integrations/github/repositories/100/branches',
      {
        params: {
          workspaceId: 'workspace-1',
        },
      },
    );
    expect(response.branches).toHaveLength(1);
    expect(response.defaultBranch).toBe('main');
  });

  it('disconnects github connection', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });

    const response = await disconnectGithubConnection();

    expect(apiClient.delete).toHaveBeenCalledWith('/integrations/github/connection');
    expect(response.success).toBe(true);
  });
});
