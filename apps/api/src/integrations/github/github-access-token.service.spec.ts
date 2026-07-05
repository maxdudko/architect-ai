import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GithubAccountsRepository } from './github-accounts.repository';
import {
  GithubHttpService,
  GithubRefreshTokenInvalidError,
  GithubUnauthorizedError,
} from './github-http.service';
import {
  GITHUB_RECONNECT_REQUIRED_CODE,
  GithubAccessTokenService,
} from './github-access-token.service';
import { GithubTokenCipherService } from './github-token-cipher.service';

describe('GithubAccessTokenService', () => {
  let service: GithubAccessTokenService;
  let accountsRepository: jest.Mocked<GithubAccountsRepository>;
  let githubTokenCipherService: jest.Mocked<GithubTokenCipherService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;

  beforeEach(() => {
    accountsRepository = {
      findByUserId: jest.fn(),
      findByProviderUserId: jest.fn(),
      upsertGithubAccount: jest.fn(),
      softDeleteByUserId: jest.fn(),
      updateTokensByUserId: jest.fn(),
    } as unknown as jest.Mocked<GithubAccountsRepository>;
    githubTokenCipherService = {
      encrypt: jest.fn((value: string) => `encrypted:${value}`),
      decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
    } as unknown as jest.Mocked<GithubTokenCipherService>;
    githubHttpService = {
      buildConnectUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      exchangeRefreshToken: jest.fn(),
      getViewer: jest.fn(),
      listRepositories: jest.fn(),
      getRepositoryById: jest.fn(),
    } as unknown as jest.Mocked<GithubHttpService>;

    service = new GithubAccessTokenService(
      accountsRepository,
      githubTokenCipherService,
      githubHttpService,
    );
  });

  it('runs operation with current token when valid', async () => {
    accountsRepository.findByUserId.mockResolvedValue({
      accessTokenEncrypted: 'encrypted:access-token',
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
    } as never);

    const result = await service.executeWithAccessToken('user-1', (token) =>
      Promise.resolve(`ok:${token}`),
    );

    expect(result).toBe('ok:access-token');
  });

  it('refreshes and retries when github returns unauthorized', async () => {
    accountsRepository.findByUserId.mockResolvedValue({
      accessTokenEncrypted: 'encrypted:old-access-token',
      refreshTokenEncrypted: 'encrypted:refresh-token',
      tokenExpiresAt: null,
    } as never);
    githubHttpService.exchangeRefreshToken.mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
      scope: 'repo',
      expires_in: 3600,
    });
    accountsRepository.updateTokensByUserId.mockResolvedValue(1);

    const operation = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new GithubUnauthorizedError())
      .mockResolvedValueOnce('success');

    const result = await service.executeWithAccessToken('user-1', operation);

    expect(result).toBe('success');
    expect(githubHttpService.exchangeRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(accountsRepository.updateTokensByUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        accessTokenEncrypted: 'encrypted:new-access-token',
        refreshTokenEncrypted: 'encrypted:new-refresh-token',
      }),
    );
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenLastCalledWith('new-access-token');
  });

  it('marks account for reconnect when no refresh token is available', async () => {
    accountsRepository.findByUserId.mockResolvedValue({
      accessTokenEncrypted: 'encrypted:old-access-token',
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
    } as never);
    accountsRepository.softDeleteByUserId.mockResolvedValue(1);

    let thrown: UnauthorizedException | null = null;
    try {
      await service.executeWithAccessToken('user-1', () => {
        throw new GithubUnauthorizedError();
      });
    } catch (error) {
      thrown = error as UnauthorizedException;
    }
    expect(thrown).toBeInstanceOf(UnauthorizedException);
    expect(thrown?.getResponse()).toEqual(
      expect.objectContaining({
        code: GITHUB_RECONNECT_REQUIRED_CODE,
      }),
    );
    expect(accountsRepository.softDeleteByUserId).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('marks account for reconnect when refresh token is invalid', async () => {
    accountsRepository.findByUserId.mockResolvedValue({
      accessTokenEncrypted: 'encrypted:old-access-token',
      refreshTokenEncrypted: 'encrypted:refresh-token',
      tokenExpiresAt: null,
    } as never);
    githubHttpService.exchangeRefreshToken.mockRejectedValue(
      new GithubRefreshTokenInvalidError(),
    );
    accountsRepository.softDeleteByUserId.mockResolvedValue(1);

    let thrown: UnauthorizedException | null = null;
    try {
      await service.executeWithAccessToken('user-1', () => {
        throw new GithubUnauthorizedError();
      });
    } catch (error) {
      thrown = error as UnauthorizedException;
    }
    expect(thrown).toBeInstanceOf(UnauthorizedException);
    expect(thrown?.getResponse()).toEqual(
      expect.objectContaining({
        code: GITHUB_RECONNECT_REQUIRED_CODE,
      }),
    );
    expect(accountsRepository.softDeleteByUserId).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('throws when account is not connected', async () => {
    accountsRepository.findByUserId.mockResolvedValue(null);

    await expect(
      service.executeWithAccessToken('user-1', () => Promise.resolve('ok')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
