import { IdentityProvider, User, WorkspaceRole } from '@prisma/client';
import { AuthService } from '../auth.service';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { GithubIdentityOauthClient } from './github-identity-oauth.client';
import { GoogleOauthClient } from './google-oauth.client';
import { IdentityAccountsRepository } from './identity-accounts.repository';
import { OauthProfile } from './interfaces/oauth-profile.interface';
import { OauthFlowException } from './oauth-errors';
import { OauthService } from './oauth.service';
import { OauthStateService } from './oauth-state.service';

describe('OauthService', () => {
  const userId = 'user-1';
  const workspaceId = 'workspace-1';
  const email = 'ada@architect.ai.test';

  const user: User = {
    id: userId,
    email,
    passwordHash: 'hashed-password',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: null,
    emailVerified: true,
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    deletedAt: null,
    lastLoginAt: new Date('2026-08-23T00:00:00.000Z'),
  };

  const googleProfile: OauthProfile = {
    provider: 'google',
    providerUserId: 'google-1',
    email,
    emailVerified: true,
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
  };

  const authResponse = {
    accessToken: 'access',
    refreshToken: 'refresh',
    user: {
      id: userId,
      email,
      firstName: 'Ada',
      lastName: 'Lovelace',
      avatarUrl: null,
      emailVerified: true,
      lastLoginAt: user.lastLoginAt,
    },
    workspaces: [
      {
        id: workspaceId,
        name: "Ada's Workspace",
        slug: 'ada-s-workspace',
        role: WorkspaceRole.OWNER,
      },
    ],
    activeWorkspace: {
      id: workspaceId,
      name: "Ada's Workspace",
      slug: 'ada-s-workspace',
      role: WorkspaceRole.OWNER,
    },
  };

  let oauthStateService: jest.Mocked<OauthStateService>;
  let googleOauthClient: jest.Mocked<GoogleOauthClient>;
  let githubIdentityOauthClient: jest.Mocked<GithubIdentityOauthClient>;
  let identityAccountsRepository: jest.Mocked<IdentityAccountsRepository>;
  let usersService: jest.Mocked<UsersService>;
  let workspacesService: jest.Mocked<WorkspacesService>;
  let authService: jest.Mocked<Pick<AuthService, 'createSessionForUser'>>;
  let systemLogsService: jest.Mocked<Pick<SystemLogsService, 'record'>>;
  let service: OauthService;

  beforeEach(() => {
    oauthStateService = {
      createState: jest.fn(),
      verifyState: jest.fn(),
    } as unknown as jest.Mocked<OauthStateService>;
    googleOauthClient = {
      buildAuthorizeUrl: jest.fn(),
      exchangeCodeForProfile: jest.fn(),
    } as unknown as jest.Mocked<GoogleOauthClient>;
    githubIdentityOauthClient = {
      buildAuthorizeUrl: jest.fn(),
      exchangeCodeForProfile: jest.fn(),
    } as unknown as jest.Mocked<GithubIdentityOauthClient>;
    identityAccountsRepository = {
      findByProviderUserId: jest.fn(),
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<IdentityAccountsRepository>;
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    workspacesService = {
      createPersonalWorkspace: jest.fn(),
      listForUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesService>;
    authService = {
      createSessionForUser: jest.fn(),
    };
    systemLogsService = {
      record: jest.fn(),
    };

    service = new OauthService(
      oauthStateService,
      googleOauthClient,
      githubIdentityOauthClient,
      identityAccountsRepository,
      usersService,
      workspacesService,
      authService as unknown as AuthService,
      systemLogsService as unknown as SystemLogsService,
    );

    oauthStateService.verifyState.mockReturnValue({ provider: 'google' });
    googleOauthClient.exchangeCodeForProfile.mockResolvedValue(googleProfile);
    usersService.findById.mockResolvedValue(user);
    workspacesService.listForUser.mockResolvedValue([
      {
        id: workspaceId,
        name: "Ada's Workspace",
        slug: 'ada-s-workspace',
        role: WorkspaceRole.OWNER,
      },
    ]);
    authService.createSessionForUser.mockResolvedValue(authResponse);
  });

  it('creates a user, personal workspace, and identity on first Google login', async () => {
    identityAccountsRepository.findByProviderUserId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({ ...user, passwordHash: null });
    workspacesService.createPersonalWorkspace.mockResolvedValue({
      id: workspaceId,
      name: "Ada's Workspace",
      slug: 'ada-s-workspace',
      planId: 'plan-free',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    usersService.findById.mockResolvedValue({ ...user, passwordHash: null });

    const result = await service.authenticateFromCallback('google', {
      code: 'code',
      state: 'state',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        emailVerified: true,
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    );
    expect(usersService.create.mock.calls[0]?.[0]).not.toHaveProperty(
      'passwordHash',
    );
    expect(workspacesService.createPersonalWorkspace).toHaveBeenCalledWith(
      userId,
      'Ada',
    );
    expect(identityAccountsRepository.create).toHaveBeenCalledWith({
      userId,
      provider: IdentityProvider.GOOGLE,
      providerUserId: 'google-1',
      email,
    });
    expect(result.auth.accessToken).toBe('access');
  });

  it('signs in an existing identity account', async () => {
    identityAccountsRepository.findByProviderUserId.mockResolvedValue({
      id: 'identity-1',
      userId,
      provider: IdentityProvider.GOOGLE,
      providerUserId: 'google-1',
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
      user,
    });

    const result = await service.authenticateFromCallback('google', {
      code: 'code',
      state: 'state',
    });

    expect(usersService.create).not.toHaveBeenCalled();
    expect(identityAccountsRepository.create).not.toHaveBeenCalled();
    expect(result.auth.user.id).toBe(userId);
  });

  it('auto-links a verified email to an existing password account', async () => {
    identityAccountsRepository.findByProviderUserId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(user);
    identityAccountsRepository.findByUserAndProvider.mockResolvedValue(null);

    await service.authenticateFromCallback('google', {
      code: 'code',
      state: 'state',
    });

    expect(identityAccountsRepository.create).toHaveBeenCalledWith({
      userId,
      provider: IdentityProvider.GOOGLE,
      providerUserId: 'google-1',
      email,
    });
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('rejects profiles without a verified email', async () => {
    googleOauthClient.exchangeCodeForProfile.mockResolvedValue({
      ...googleProfile,
      email: null,
      emailVerified: false,
    });

    await expect(
      service.authenticateFromCallback('google', {
        code: 'code',
        state: 'state',
      }),
    ).rejects.toBeInstanceOf(OauthFlowException);
  });

  it('rejects deleted users linked by provider', async () => {
    identityAccountsRepository.findByProviderUserId.mockResolvedValue({
      id: 'identity-1',
      userId,
      provider: IdentityProvider.GOOGLE,
      providerUserId: 'google-1',
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { ...user, deletedAt: new Date() },
    });

    await expect(
      service.authenticateFromCallback('google', {
        code: 'code',
        state: 'state',
      }),
    ).rejects.toMatchObject({ code: 'account_unavailable' });
  });

  it('rejects auto-link when the provider is already linked to a different account id', async () => {
    identityAccountsRepository.findByProviderUserId.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(user);
    identityAccountsRepository.findByUserAndProvider.mockResolvedValue({
      id: 'identity-1',
      userId,
      provider: IdentityProvider.GOOGLE,
      providerUserId: 'google-other',
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.authenticateFromCallback('google', {
        code: 'code',
        state: 'state',
      }),
    ).rejects.toMatchObject({ code: 'provider_conflict' });
  });
});
