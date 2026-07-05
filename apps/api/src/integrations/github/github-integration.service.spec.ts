import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RepositoryProvider } from '@prisma/client';
import { RepositoriesRepository } from '../../repositories/repositories.repository';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { GithubAccountsRepository } from './github-accounts.repository';
import { GithubAccessTokenService } from './github-access-token.service';
import { GithubHttpService } from './github-http.service';
import { GithubOauthStateService } from './github-oauth-state.service';
import { GithubTokenCipherService } from './github-token-cipher.service';
import { GithubIntegrationService } from './github-integration.service';

describe('GithubIntegrationService', () => {
  let service: GithubIntegrationService;
  let workspacesService: jest.Mocked<WorkspacesService>;
  let repositoriesRepository: jest.Mocked<RepositoriesRepository>;
  let accountsRepository: jest.Mocked<GithubAccountsRepository>;
  let githubOauthStateService: jest.Mocked<GithubOauthStateService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;
  let githubTokenCipherService: jest.Mocked<GithubTokenCipherService>;
  let githubAccessTokenService: jest.Mocked<GithubAccessTokenService>;

  beforeEach(() => {
    workspacesService = {
      getWorkspaceForUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesService>;
    repositoriesRepository = {
      listExternalIdsByProvider: jest.fn(),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    accountsRepository = {
      findByProviderUserId: jest.fn(),
      upsertGithubAccount: jest.fn(),
      findByUserId: jest.fn(),
      softDeleteByUserId: jest.fn(),
      updateTokensByUserId: jest.fn(),
    } as unknown as jest.Mocked<GithubAccountsRepository>;
    githubOauthStateService = {
      createState: jest.fn(),
      verifyState: jest.fn(),
    } as unknown as jest.Mocked<GithubOauthStateService>;
    githubHttpService = {
      buildConnectUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      exchangeRefreshToken: jest.fn(),
      getViewer: jest.fn(),
      listRepositories: jest.fn(),
      getRepositoryById: jest.fn(),
    } as unknown as jest.Mocked<GithubHttpService>;
    githubTokenCipherService = {
      encrypt: jest.fn((value: string) => `encrypted:${value}`),
      decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
    } as unknown as jest.Mocked<GithubTokenCipherService>;
    githubAccessTokenService = {
      executeWithAccessToken: jest.fn(),
    } as unknown as jest.Mocked<GithubAccessTokenService>;

    service = new GithubIntegrationService(
      workspacesService,
      repositoriesRepository,
      accountsRepository,
      githubOauthStateService,
      githubHttpService,
      githubTokenCipherService,
      githubAccessTokenService,
    );
  });

  it('builds connect URL with signed state', async () => {
    githubOauthStateService.createState.mockReturnValue('signed-state');
    githubHttpService.buildConnectUrl.mockReturnValue(
      'https://github.com/oauth',
    );

    const url = await service.getConnectUrl('user-1', 'workspace-1');

    expect(workspacesService.getWorkspaceForUser).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
    );
    expect(url).toBe('https://github.com/oauth');
  });

  it('persists encrypted tokens after callback', async () => {
    githubOauthStateService.verifyState.mockReturnValue({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
    githubHttpService.exchangeCodeForToken.mockResolvedValue({
      access_token: 'token',
      token_type: 'bearer',
      scope: 'repo',
    });
    githubHttpService.getViewer.mockResolvedValue({
      id: 123,
      login: 'octocat',
    });
    accountsRepository.findByProviderUserId.mockResolvedValue(null);
    accountsRepository.upsertGithubAccount.mockResolvedValue({} as never);

    const result = await service.processCallback({
      code: 'oauth-code',
      state: 'state',
    });

    expect(result.workspaceId).toBe('workspace-1');
    expect(accountsRepository.upsertGithubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        providerUserId: '123',
        login: 'octocat',
        accessTokenEncrypted: 'encrypted:token',
      }),
    );
  });

  it('throws conflict when github account belongs to another user', async () => {
    githubOauthStateService.verifyState.mockReturnValue({
      userId: 'user-1',
    });
    githubHttpService.exchangeCodeForToken.mockResolvedValue({
      access_token: 'token',
      token_type: 'bearer',
      scope: 'repo',
    });
    githubHttpService.getViewer.mockResolvedValue({
      id: 123,
      login: 'octocat',
    });
    accountsRepository.findByProviderUserId.mockResolvedValue({
      userId: 'other-user',
    } as never);

    await expect(
      service.processCallback({
        code: 'oauth-code',
        state: 'state',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns repository page with connectable flags', async () => {
    workspacesService.getWorkspaceForUser.mockResolvedValue({} as never);
    accountsRepository.findByUserId.mockResolvedValue({
      accessTokenEncrypted: 'encrypted:token',
    } as never);
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('token'),
    );
    githubHttpService.listRepositories.mockResolvedValue({
      repositories: [
        {
          id: 100,
          owner: { login: 'acme' },
          name: 'platform',
          full_name: 'acme/platform',
          private: true,
          default_branch: 'main',
        },
      ],
      hasNextPage: false,
    });
    repositoriesRepository.listExternalIdsByProvider.mockResolvedValue(['100']);

    const result = await service.listRepositories('user-1', 'workspace-1');

    expect(
      repositoriesRepository.listExternalIdsByProvider,
    ).toHaveBeenCalledWith(RepositoryProvider.GITHUB);
    expect(result.repositories).toEqual([
      {
        id: '100',
        owner: 'acme',
        name: 'platform',
        fullName: 'acme/platform',
        defaultBranch: 'main',
        isPrivate: true,
        connectable: false,
      },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('requires connected account before listing repositories', async () => {
    workspacesService.getWorkspaceForUser.mockResolvedValue({} as never);
    githubAccessTokenService.executeWithAccessToken.mockRejectedValue(
      new NotFoundException('GitHub account is not connected'),
    );

    await expect(
      service.listRepositories('user-1', 'workspace-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid callback payloads', async () => {
    await expect(service.processCallback({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
