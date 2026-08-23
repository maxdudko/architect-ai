import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  IdentityProvider,
  SystemLogCategory,
  SystemLogLevel,
} from '@prisma/client';
import { AuthService } from '../auth.service';
import { AuthResponse } from '../interfaces/auth-response.interface';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { GithubIdentityOauthClient } from './github-identity-oauth.client';
import { GoogleOauthClient } from './google-oauth.client';
import { IdentityAccountsRepository } from './identity-accounts.repository';
import { OauthProfile } from './interfaces/oauth-profile.interface';
import { OauthErrorCode, OauthFlowException } from './oauth-errors';
import { sanitizeOauthNextPath } from './oauth-names';
import type { OauthProviderName } from './oauth-provider';
import { OauthStateService } from './oauth-state.service';

@Injectable()
export class OauthService {
  constructor(
    private readonly oauthStateService: OauthStateService,
    private readonly googleOauthClient: GoogleOauthClient,
    private readonly githubIdentityOauthClient: GithubIdentityOauthClient,
    private readonly identityAccountsRepository: IdentityAccountsRepository,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly authService: AuthService,
    private readonly systemLogsService: SystemLogsService,
  ) {}

  buildAuthorizeUrl(provider: OauthProviderName, next?: string): string {
    const state = this.oauthStateService.createState({
      provider,
      next: sanitizeOauthNextPath(next),
    });
    if (provider === 'google') {
      return this.googleOauthClient.buildAuthorizeUrl(state);
    }
    return this.githubIdentityOauthClient.buildAuthorizeUrl(state);
  }

  async authenticateFromCallback(
    provider: OauthProviderName,
    params: {
      code?: string;
      state?: string;
      error?: string;
    },
  ): Promise<{ auth: AuthResponse; next?: string }> {
    if (params.error) {
      throw new OauthFlowException(
        params.error === 'access_denied' ? 'access_denied' : 'provider_error',
      );
    }
    if (!params.code || !params.state) {
      throw new OauthFlowException('provider_error', 'Missing OAuth code');
    }

    const state = this.oauthStateService.verifyState(params.state, provider);
    const profile =
      provider === 'google'
        ? await this.googleOauthClient.exchangeCodeForProfile(params.code)
        : await this.githubIdentityOauthClient.exchangeCodeForProfile(
            params.code,
          );

    const auth = await this.resolveAuthResponse(profile);
    return { auth, next: state.next };
  }

  mapErrorCode(error: unknown): OauthErrorCode {
    if (error instanceof OauthFlowException) {
      return error.code;
    }
    if (error instanceof UnauthorizedException) {
      return 'invalid_state';
    }
    if (error instanceof ServiceUnavailableException) {
      return 'not_configured';
    }
    return 'provider_error';
  }

  private async resolveAuthResponse(
    profile: OauthProfile,
  ): Promise<AuthResponse> {
    if (!profile.email || !profile.emailVerified) {
      throw new OauthFlowException('email_unavailable');
    }

    const identityProvider = this.toIdentityProvider(profile.provider);
    const existingIdentity =
      await this.identityAccountsRepository.findByProviderUserId(
        identityProvider,
        profile.providerUserId,
      );

    if (existingIdentity) {
      if (existingIdentity.user.deletedAt) {
        throw new OauthFlowException('account_unavailable');
      }
      return this.issueSession(existingIdentity.user.id, profile.provider);
    }

    const existingUser = await this.usersService.findByEmail(profile.email);
    if (existingUser) {
      if (existingUser.deletedAt) {
        throw new OauthFlowException('account_unavailable');
      }

      const linked =
        await this.identityAccountsRepository.findByUserAndProvider(
          existingUser.id,
          identityProvider,
        );
      if (linked && linked.providerUserId !== profile.providerUserId) {
        throw new OauthFlowException('provider_conflict');
      }
      if (!linked) {
        await this.identityAccountsRepository.create({
          userId: existingUser.id,
          provider: identityProvider,
          providerUserId: profile.providerUserId,
          email: profile.email,
        });
      }

      return this.issueSession(existingUser.id, profile.provider);
    }

    const user = await this.usersService.create({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      emailVerified: true,
      lastLoginAt: new Date(),
    });

    const personalWorkspace =
      await this.workspacesService.createPersonalWorkspace(
        user.id,
        user.firstName,
      );
    await this.identityAccountsRepository.create({
      userId: user.id,
      provider: identityProvider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    });

    return this.issueSession(user.id, profile.provider, personalWorkspace.id);
  }

  private async issueSession(
    userId: string,
    provider: OauthProviderName,
    activeWorkspaceId?: string,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    if (!user || user.deletedAt) {
      throw new OauthFlowException('account_unavailable');
    }

    const workspaceId =
      activeWorkspaceId ??
      (await this.workspacesService.listForUser(user.id))[0]?.id;
    if (!workspaceId) {
      throw new OauthFlowException('account_unavailable');
    }

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'user.auth.oauth.success',
      actorType: 'user',
      actorId: user.id,
      message: 'User authenticated with identity provider',
      metadata: { email: user.email, provider },
    });

    return this.authService.createSessionForUser(user.id, workspaceId);
  }

  private toIdentityProvider(provider: OauthProviderName): IdentityProvider {
    return provider === 'google'
      ? IdentityProvider.GOOGLE
      : IdentityProvider.GITHUB;
  }
}
