import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, WorkspacePlan, WorkspaceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { SessionStoreService } from './session-store.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  const userId = 'user-1';
  const workspaceId = 'workspace-1';
  const email = 'user@architect.ai.test';

  const user: User = {
    id: userId,
    email,
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    emailVerified: false,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
    lastLoginAt: new Date('2026-06-24T00:00:00.000Z'),
  };

  const workspaceSummary = {
    id: workspaceId,
    name: "Test's Workspace",
    slug: 'test-workspace',
    role: WorkspaceRole.OWNER,
  };

  const personalWorkspace = {
    id: workspaceId,
    name: "Test's Workspace",
    slug: 'test-workspace',
    plan: WorkspacePlan.FREE,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  let usersService: jest.Mocked<UsersService>;
  let workspacesService: jest.Mocked<WorkspacesService>;
  let sessionStoreService: jest.Mocked<SessionStoreService>;
  let systemLogsService: jest.Mocked<Pick<SystemLogsService, 'record'>>;
  let configService: { get: jest.Mock };
  let jwtService: JwtService;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      touchLastLoginAt: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    workspacesService = {
      createPersonalWorkspace: jest.fn(),
      listForUser: jest.fn(),
      getWorkspaceForUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesService>;

    sessionStoreService = {
      addRefreshToken: jest.fn(),
      hasRefreshToken: jest.fn(),
      removeRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<SessionStoreService>;

    systemLogsService = {
      record: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '30d',
        };
        return values[key];
      }),
    };

    jwtService = new JwtService();
    service = new AuthService(
      usersService,
      workspacesService,
      jwtService,
      configService as never,
      sessionStoreService,
      systemLogsService as unknown as SystemLogsService,
    );

    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    workspacesService.listForUser.mockResolvedValue([workspaceSummary]);
    sessionStoreService.addRefreshToken.mockResolvedValue(undefined);
    sessionStoreService.hasRefreshToken.mockResolvedValue(true);
    sessionStoreService.removeRefreshToken.mockResolvedValue(undefined);
  });

  describe('signUp', () => {
    it('creates a user, personal workspace, and auth response', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);
      workspacesService.createPersonalWorkspace.mockResolvedValue(
        personalWorkspace,
      );

      const result = await service.signUp({
        email,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email.toLowerCase(),
          firstName: 'Test',
          lastName: 'User',
          emailVerified: false,
        }),
      );
      expect(workspacesService.createPersonalWorkspace).toHaveBeenCalledWith(
        userId,
        'Test',
      );
      expect(sessionStoreService.addRefreshToken).toHaveBeenCalled();
      expect(result.user.email).toBe(email);
      expect(result.activeWorkspace.id).toBe(workspaceId);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('throws when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.signUp({
          email,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('signIn', () => {
    it('returns tokens for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      usersService.touchLastLoginAt.mockResolvedValue(user);

      const result = await service.signIn({
        email,
        password: 'Password123!',
      });

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        user.passwordHash,
      );
      expect(result.user.id).toBe(userId);
      expect(result.activeWorkspace.id).toBe(workspaceId);
    });

    it('rejects invalid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.signIn({ email, password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects deleted users', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(
        service.signIn({ email, password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects users without workspace memberships', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      usersService.touchLastLoginAt.mockResolvedValue(user);
      workspacesService.listForUser.mockResolvedValue([]);

      await expect(
        service.signIn({ email, password: 'Password123!' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('refresh', () => {
    async function issueRefreshToken(): Promise<string> {
      const signInResult = await service.signIn({
        email,
        password: 'Password123!',
      });
      usersService.findByEmail.mockResolvedValue(user);
      usersService.findById.mockResolvedValue(user);
      usersService.touchLastLoginAt.mockResolvedValue(user);
      workspacesService.listForUser.mockResolvedValue([workspaceSummary]);
      sessionStoreService.hasRefreshToken.mockResolvedValue(true);
      return signInResult.refreshToken;
    }

    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue(user);
      usersService.touchLastLoginAt.mockResolvedValue(user);
      usersService.findById.mockResolvedValue(user);
    });

    it('rotates refresh tokens when the session is valid', async () => {
      const refreshToken = await issueRefreshToken();

      const result = await service.refresh({ refreshToken });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(sessionStoreService.removeRefreshToken).toHaveBeenCalledWith(
        userId,
        refreshToken,
      );
      expect(sessionStoreService.addRefreshToken).toHaveBeenCalledWith(
        userId,
        result.refreshToken,
      );
    });

    it('rejects revoked refresh tokens', async () => {
      const refreshToken = await issueRefreshToken();
      sessionStoreService.hasRefreshToken.mockResolvedValue(false);

      await expect(service.refresh({ refreshToken })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects refresh when active workspace is no longer accessible', async () => {
      const refreshToken = await issueRefreshToken();
      workspacesService.listForUser.mockResolvedValue([]);

      await expect(
        service.refresh({
          refreshToken,
          activeWorkspaceId: workspaceId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects refresh for a workspace the user is not a member of', async () => {
      const refreshToken = await issueRefreshToken();

      await expect(
        service.refresh({
          refreshToken,
          activeWorkspaceId: 'foreign-workspace',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('removes the refresh token from the session store', async () => {
      const result = await service.logout(userId, 'refresh-token');

      expect(result).toEqual({ success: true });
      expect(sessionStoreService.removeRefreshToken).toHaveBeenCalledWith(
        userId,
        'refresh-token',
      );
    });
  });

  describe('switchActiveWorkspace', () => {
    const otherWorkspaceId = 'workspace-2';

    async function issueRefreshToken(): Promise<string> {
      usersService.findByEmail.mockResolvedValue(user);
      usersService.touchLastLoginAt.mockResolvedValue(user);
      const signInResult = await service.signIn({
        email,
        password: 'Password123!',
      });
      return signInResult.refreshToken;
    }

    it('issues new tokens with the selected workspace', async () => {
      const refreshToken = await issueRefreshToken();
      workspacesService.getWorkspaceForUser.mockResolvedValue({
        workspace: {
          ...personalWorkspace,
          id: otherWorkspaceId,
          name: 'Team Workspace',
          slug: 'team-workspace',
        },
        role: WorkspaceRole.MEMBER,
      });

      const result = await service.switchActiveWorkspace(
        userId,
        email,
        otherWorkspaceId,
        refreshToken,
      );

      expect(result.activeWorkspace).toEqual({
        id: otherWorkspaceId,
        name: 'Team Workspace',
        slug: 'team-workspace',
        role: WorkspaceRole.MEMBER,
      });
      expect(sessionStoreService.removeRefreshToken).toHaveBeenCalledWith(
        userId,
        refreshToken,
      );
      expect(sessionStoreService.addRefreshToken).toHaveBeenCalledWith(
        userId,
        result.refreshToken,
      );
    });

    it('rejects refresh tokens that do not belong to the user', async () => {
      const refreshToken = await issueRefreshToken();
      workspacesService.getWorkspaceForUser.mockResolvedValue({
        workspace: personalWorkspace,
        role: WorkspaceRole.OWNER,
      });

      await expect(
        service.switchActiveWorkspace(
          'other-user',
          email,
          otherWorkspaceId,
          refreshToken,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects revoked refresh tokens', async () => {
      const refreshToken = await issueRefreshToken();
      sessionStoreService.hasRefreshToken.mockResolvedValue(false);
      workspacesService.getWorkspaceForUser.mockResolvedValue({
        workspace: personalWorkspace,
        role: WorkspaceRole.OWNER,
      });

      await expect(
        service.switchActiveWorkspace(userId, email, workspaceId, refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('returns user context for the active workspace', async () => {
      usersService.findById.mockResolvedValue(user);

      const result = await service.me({
        sub: userId,
        email,
        activeWorkspaceId: workspaceId,
      });

      expect(result.user.email).toBe(email);
      expect(result.activeWorkspace.id).toBe(workspaceId);
      expect(result.workspaces).toHaveLength(1);
    });

    it('throws when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.me({
          sub: userId,
          email,
          activeWorkspaceId: workspaceId,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
