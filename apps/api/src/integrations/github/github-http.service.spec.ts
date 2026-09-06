import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GithubHttpService } from './github-http.service';

describe('GithubHttpService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: GithubHttpService;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new GithubHttpService({
      get: (key: string) => {
        if (key === 'GITHUB_CLIENT_ID') {
          return 'Iv1.test-app';
        }
        if (key === 'GITHUB_CLIENT_SECRET') {
          return 'secret';
        }
        if (key === 'GITHUB_OAUTH_REDIRECT_URI') {
          return 'https://api.example.com/integrations/github/callback';
        }
        return undefined;
      },
    } as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns OAuth user repositories when GitHub sends any', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () =>
        Promise.resolve([
          {
            id: 1,
            name: 'platform',
            full_name: 'acme/platform',
            private: true,
            default_branch: 'main',
            owner: { login: 'acme' },
          },
        ]),
    });

    const result = await service.listRepositories('token', 1, 30);

    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0]?.full_name).toBe('acme/platform');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lists GitHub App installation repositories when /user/repos is empty', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            total_count: 1,
            installations: [{ id: 42, app_slug: 'architect-ai' }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            total_count: 1,
            repositories: [
              {
                id: 9,
                name: 'private-app',
                full_name: 'maxdudko/private-app',
                private: true,
                default_branch: 'main',
                owner: { login: 'maxdudko' },
              },
            ],
          }),
      });

    const result = await service.listRepositories('token', 1, 30);

    expect(result.repositories).toEqual([
      expect.objectContaining({ full_name: 'maxdudko/private-app' }),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.github.com/user/installations/42/repositories?page=1&per_page=100',
      expect.any(Object),
    );
  });

  it('rejects when a GitHub App token has no installations', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ total_count: 0, installations: [] }),
      });

    await expect(
      service.listRepositories('token', 1, 30),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('returns an empty OAuth list when installations are forbidden', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

    const result = await service.listRepositories('token', 1, 30);

    expect(result.repositories).toEqual([]);
  });
});
