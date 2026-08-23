import { ConflictException, NotFoundException } from '@nestjs/common';
import { SystemLogCategory, SystemLogLevel, User } from '@prisma/client';
import { AuthService } from '../../auth/auth.service';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { UsersService } from '../../users/users.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  const adminId = 'admin-1';
  const userId = 'user-1';

  const user: User = {
    id: userId,
    email: 'user@example.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    emailVerified: false,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
    lastLoginAt: null,
  };

  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'findById' | 'findByEmail' | 'update' | 'softDelete' | 'restore'
    >
  >;
  let authService: jest.Mocked<Pick<AuthService, 'revokeAllSessions'>>;
  let systemLogsService: jest.Mocked<Pick<SystemLogsService, 'record'>>;
  let service: AdminUsersService;

  beforeEach(() => {
    usersService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
    };
    authService = {
      revokeAllSessions: jest.fn(),
    };
    systemLogsService = {
      record: jest.fn(),
    };
    service = new AdminUsersService(
      usersService as unknown as UsersService,
      authService as unknown as AuthService,
      systemLogsService as unknown as SystemLogsService,
    );
  });

  it('updates user fields and writes an audit log', async () => {
    usersService.findById.mockResolvedValue(user);
    usersService.findByEmail.mockResolvedValue(null);
    const updated = {
      ...user,
      firstName: 'Ada',
      email: 'ada@example.com',
      emailVerified: true,
    };
    usersService.update.mockResolvedValue(updated);

    const result = await service.updateUser(
      userId,
      {
        firstName: 'Ada',
        email: 'Ada@example.com',
        emailVerified: true,
      },
      adminId,
    );

    expect(usersService.update).toHaveBeenCalledWith(userId, {
      firstName: 'Ada',
      email: 'ada@example.com',
      emailVerified: true,
    });
    expect(result).toEqual(updated);
    expect(systemLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.INFO,
        event: 'admin.user.update',
        actorId: adminId,
      }),
    );
  });

  it('rejects email conflicts', async () => {
    usersService.findById.mockResolvedValue(user);
    usersService.findByEmail.mockResolvedValue({
      ...user,
      id: 'other-user',
      email: 'taken@example.com',
    });

    await expect(
      service.updateUser(userId, { email: 'taken@example.com' }, adminId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bans a user and revokes sessions', async () => {
    usersService.findById.mockResolvedValue(user);
    const banned = { ...user, deletedAt: new Date() };
    usersService.softDelete.mockResolvedValue(banned);

    const result = await service.banUser(userId, adminId);

    expect(result.deletedAt).toBeTruthy();
    expect(authService.revokeAllSessions).toHaveBeenCalledWith(userId);
    expect(systemLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.user.ban',
        actorId: adminId,
      }),
    );
  });

  it('unbans a banned user', async () => {
    usersService.findById.mockResolvedValue({
      ...user,
      deletedAt: new Date(),
    });
    usersService.restore.mockResolvedValue(user);

    const result = await service.unbanUser(userId, adminId);

    expect(result.deletedAt).toBeNull();
    expect(usersService.restore).toHaveBeenCalledWith(userId);
  });

  it('throws when the user does not exist', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      service.updateUser(userId, { firstName: 'X' }, adminId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
