import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthAccount } from '@prisma/client';
import { GithubAccountsRepository } from './github-accounts.repository';
import {
  GithubHttpService,
  GithubRefreshTokenInvalidError,
  GithubUnauthorizedError,
} from './github-http.service';
import { GithubTokenCipherService } from './github-token-cipher.service';

export const GITHUB_RECONNECT_REQUIRED_CODE = 'GITHUB_RECONNECT_REQUIRED';

@Injectable()
export class GithubAccessTokenService {
  constructor(
    private readonly githubAccountsRepository: GithubAccountsRepository,
    private readonly githubTokenCipherService: GithubTokenCipherService,
    private readonly githubHttpService: GithubHttpService,
  ) {}

  async executeWithAccessToken<T>(
    userId: string,
    operation: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    const account = await this.getConnectedAccount(userId);
    let accessToken = this.githubTokenCipherService.decrypt(
      account.accessTokenEncrypted,
    );

    if (this.shouldRefreshProactively(account)) {
      accessToken = await this.refreshAccessToken(userId, account);
    }

    try {
      return await operation(accessToken);
    } catch (error) {
      if (!(error instanceof GithubUnauthorizedError)) {
        throw error;
      }

      if (!account.refreshTokenEncrypted) {
        await this.throwReconnectRequired(userId);
      }

      try {
        const refreshedAccessToken = await this.refreshAccessToken(
          userId,
          account,
        );
        return await operation(refreshedAccessToken);
      } catch (refreshError) {
        if (refreshError instanceof GithubRefreshTokenInvalidError) {
          await this.throwReconnectRequired(userId);
        }
        throw refreshError;
      }
    }
  }

  private async getConnectedAccount(userId: string): Promise<OAuthAccount> {
    const account = await this.githubAccountsRepository.findByUserId(userId);
    if (!account) {
      throw new NotFoundException('GitHub account is not connected');
    }
    return account;
  }

  private shouldRefreshProactively(account: OAuthAccount): boolean {
    if (!account.refreshTokenEncrypted || !account.tokenExpiresAt) {
      return false;
    }
    return account.tokenExpiresAt.getTime() <= Date.now() + 30_000;
  }

  private async refreshAccessToken(
    userId: string,
    account: OAuthAccount,
  ): Promise<string> {
    const encryptedStoredRefreshToken = account.refreshTokenEncrypted;
    if (!encryptedStoredRefreshToken) {
      await this.throwReconnectRequired(userId);
    }

    const refreshToken = this.githubTokenCipherService.decrypt(
      encryptedStoredRefreshToken!,
    );
    const refreshedToken =
      await this.githubHttpService.exchangeRefreshToken(refreshToken);

    const encryptedAccessToken = this.githubTokenCipherService.encrypt(
      refreshedToken.access_token,
    );
    const encryptedRefreshToken = refreshedToken.refresh_token
      ? this.githubTokenCipherService.encrypt(refreshedToken.refresh_token)
      : encryptedStoredRefreshToken!;

    await this.githubAccountsRepository.updateTokensByUserId(userId, {
      accessTokenEncrypted: encryptedAccessToken,
      refreshTokenEncrypted: encryptedRefreshToken,
      tokenExpiresAt: refreshedToken.expires_in
        ? new Date(Date.now() + refreshedToken.expires_in * 1000)
        : null,
    });

    return refreshedToken.access_token;
  }

  private async throwReconnectRequired(userId: string): Promise<never> {
    await this.githubAccountsRepository.softDeleteByUserId(userId);
    throw new UnauthorizedException({
      message: 'GitHub authorization expired. Please reconnect GitHub.',
      code: GITHUB_RECONNECT_REQUIRED_CODE,
    });
  }
}
