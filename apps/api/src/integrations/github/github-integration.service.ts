import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { RepositoryProvider } from '@prisma/client';
import { RepositoriesRepository } from '../../repositories/repositories.repository';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { GithubAccountsRepository } from './github-accounts.repository';
import { GithubHttpService } from './github-http.service';
import { GithubOauthStateService } from './github-oauth-state.service';
import { GithubAccessTokenService } from './github-access-token.service';
import { GithubTokenCipherService } from './github-token-cipher.service';
import { GithubRepositoriesResponseDto } from './dto/github-repositories-response.dto';

const PER_PAGE = 30;

@Injectable()
export class GithubIntegrationService {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly accountsRepository: GithubAccountsRepository,
    private readonly githubOauthStateService: GithubOauthStateService,
    private readonly githubHttpService: GithubHttpService,
    private readonly githubTokenCipherService: GithubTokenCipherService,
    private readonly githubAccessTokenService: GithubAccessTokenService,
  ) {}

  async getConnectUrl(userId: string, workspaceId?: string): Promise<string> {
    if (workspaceId) {
      await this.workspacesService.getWorkspaceForUser(workspaceId, userId);
    }
    const state = this.githubOauthStateService.createState({
      userId,
      workspaceId,
    });
    return this.githubHttpService.buildConnectUrl(state);
  }

  async processCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<{ workspaceId?: string }> {
    if (params.error) {
      throw new BadRequestException(
        params.errorDescription ?? `GitHub OAuth error: ${params.error}`,
      );
    }
    if (!params.code || !params.state) {
      throw new BadRequestException('Missing OAuth callback code or state');
    }

    const state = this.githubOauthStateService.verifyState(params.state);
    const tokenResponse = await this.githubHttpService.exchangeCodeForToken(
      params.code,
    );
    const viewer = await this.githubHttpService.getViewer(
      tokenResponse.access_token,
    );

    const existingByProviderUserId =
      await this.accountsRepository.findByProviderUserId(String(viewer.id));
    if (
      existingByProviderUserId &&
      existingByProviderUserId.userId !== state.userId
    ) {
      throw new ConflictException(
        'This GitHub account is already connected to another user',
      );
    }

    await this.accountsRepository.upsertGithubAccount({
      userId: state.userId,
      providerUserId: String(viewer.id),
      login: viewer.login,
      accessTokenEncrypted: this.githubTokenCipherService.encrypt(
        tokenResponse.access_token,
      ),
      refreshTokenEncrypted: tokenResponse.refresh_token
        ? this.githubTokenCipherService.encrypt(tokenResponse.refresh_token)
        : undefined,
      tokenExpiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : undefined,
    });

    return {
      workspaceId: state.workspaceId,
    };
  }

  async getConnection(userId: string): Promise<{
    connected: boolean;
    login?: string;
    providerUserId?: string;
  }> {
    const account = await this.accountsRepository.findByUserId(userId);
    if (!account) {
      return { connected: false };
    }
    return {
      connected: true,
      login: account.login,
      providerUserId: account.providerUserId,
    };
  }

  async disconnect(userId: string): Promise<{ success: boolean }> {
    await this.accountsRepository.softDeleteByUserId(userId);
    return { success: true };
  }

  async listRepositories(
    userId: string,
    workspaceId: string,
    cursor?: string,
  ): Promise<GithubRepositoriesResponseDto> {
    await this.workspacesService.getWorkspaceForUser(workspaceId, userId);

    const page = this.decodeCursor(cursor);
    const connectedExternalIds =
      await this.repositoriesRepository.listExternalIdsByProvider(
        RepositoryProvider.GITHUB,
      );
    const githubResponse =
      await this.githubAccessTokenService.executeWithAccessToken(
        userId,
        (accessToken) =>
          this.githubHttpService.listRepositories(accessToken, page, PER_PAGE),
      );
    const connectedIdSet = new Set(connectedExternalIds);

    return {
      repositories: githubResponse.repositories.map((repository) => ({
        id: String(repository.id),
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch || 'main',
        isPrivate: repository.private,
        connectable: !connectedIdSet.has(String(repository.id)),
      })),
      nextCursor: githubResponse.hasNextPage
        ? this.encodeCursor(page + 1)
        : null,
    };
  }

  private encodeCursor(page: number): string {
    return Buffer.from(String(page)).toString('base64url');
  }

  private decodeCursor(cursor?: string): number {
    if (!cursor) {
      return 1;
    }
    try {
      const page = Number.parseInt(
        Buffer.from(cursor, 'base64url').toString('utf8'),
        10,
      );
      if (!Number.isFinite(page) || page < 1) {
        throw new Error('Invalid cursor');
      }
      return page;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }
}
