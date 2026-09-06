import { BadRequestException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetTokensRepository } from './password-reset-tokens.repository';
import { hashPasswordResetToken } from './password-reset.utils';
import { MailService } from '../mail/mail.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordResetService', () => {
  const userId = 'user-1';
  const email = 'user@architect.ai.test';
  const rawToken = 'test-reset-token-value-32bytesxx';

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

  const resetRecord = {
    id: 'token-1',
    userId,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt: new Date('2026-08-29T22:00:00.000Z'),
    usedAt: null,
    createdAt: new Date('2026-08-29T21:00:00.000Z'),
    user,
  };

  let usersService: jest.Mocked<UsersService>;
  let tokensRepository: jest.Mocked<PasswordResetTokensRepository>;
  let mailService: jest.Mocked<
    Pick<
      MailService,
      'sendPasswordReset' | 'sendOauthSignInReminder' | 'buildPasswordResetUrl'
    >
  >;
  let authService: jest.Mocked<Pick<AuthService, 'revokeAllSessions'>>;
  let systemLogsService: jest.Mocked<Pick<SystemLogsService, 'record'>>;
  let service: PasswordResetService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    tokensRepository = {
      create: jest.fn(),
      findValidByTokenHash: jest.fn(),
      invalidateUnusedForUser: jest.fn(),
      consumeForReset: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetTokensRepository>;

    mailService = {
      sendPasswordReset: jest.fn(),
      sendOauthSignInReminder: jest.fn(),
      buildPasswordResetUrl: jest.fn(
        (token: string) => `http://localhost:3000/reset-password/${token}`,
      ),
    };

    authService = {
      revokeAllSessions: jest.fn(),
    };

    systemLogsService = {
      record: jest.fn(),
    };

    service = new PasswordResetService(
      usersService,
      tokensRepository,
      mailService as unknown as MailService,
      authService as unknown as AuthService,
      systemLogsService as unknown as SystemLogsService,
    );

    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
    tokensRepository.invalidateUnusedForUser.mockResolvedValue({ count: 0 });
    tokensRepository.create.mockResolvedValue(resetRecord);
    tokensRepository.consumeForReset.mockResolvedValue(true);
    mailService.sendPasswordReset.mockResolvedValue(undefined);
    mailService.sendOauthSignInReminder.mockResolvedValue(undefined);
    authService.revokeAllSessions.mockResolvedValue(undefined);
  });

  describe('requestReset', () => {
    it('returns success without creating a token for unknown emails', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.requestReset(email)).resolves.toEqual({
        success: true,
      });
      expect(tokensRepository.create).not.toHaveBeenCalled();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('returns success without creating a token for deleted users', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        deletedAt: new Date(),
      });

      await expect(service.requestReset(email)).resolves.toEqual({
        success: true,
      });
      expect(tokensRepository.create).not.toHaveBeenCalled();
    });

    it('sends an OAuth reminder instead of a reset token', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...user,
        passwordHash: null,
      });

      await expect(service.requestReset(email)).resolves.toEqual({
        success: true,
      });
      expect(mailService.sendOauthSignInReminder).toHaveBeenCalledWith({
        to: email,
      });
      expect(tokensRepository.create).not.toHaveBeenCalled();
    });

    it('issues a hashed token and sends a reset email', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.requestReset('User@Architect.AI.Test'),
      ).resolves.toEqual({
        success: true,
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(tokensRepository.invalidateUnusedForUser).toHaveBeenCalledWith(
        userId,
      );
      expect(tokensRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
      const createdHash = tokensRepository.create.mock.calls[0]?.[0].tokenHash;
      expect(createdHash).toHaveLength(64);
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          resetUrl: expect.stringContaining('/reset-password/'),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('still succeeds when sending the reset email fails', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      mailService.sendPasswordReset.mockRejectedValue(new Error('resend down'));

      await expect(service.requestReset(email)).resolves.toEqual({
        success: true,
      });
      expect(tokensRepository.create).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password, consumes the token, and revokes sessions', async () => {
      tokensRepository.findValidByTokenHash.mockResolvedValue(resetRecord);

      await expect(
        service.resetPassword({ token: rawToken, password: 'NewPass123!' }),
      ).resolves.toEqual({ success: true });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('NewPass123!', 12);
      expect(tokensRepository.consumeForReset).toHaveBeenCalledWith({
        tokenId: resetRecord.id,
        userId,
        passwordHash: 'new-hashed-password',
      });
      expect(authService.revokeAllSessions).toHaveBeenCalledWith(userId);
    });

    it('rejects invalid tokens', async () => {
      tokensRepository.findValidByTokenHash.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: rawToken, password: 'NewPass123!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tokensRepository.consumeForReset).not.toHaveBeenCalled();
    });

    it('rejects tokens for OAuth-only accounts', async () => {
      tokensRepository.findValidByTokenHash.mockResolvedValue({
        ...resetRecord,
        user: { ...user, passwordHash: null },
      });

      await expect(
        service.resetPassword({ token: rawToken, password: 'NewPass123!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the token was already consumed', async () => {
      tokensRepository.findValidByTokenHash.mockResolvedValue(resetRecord);
      tokensRepository.consumeForReset.mockResolvedValue(false);

      await expect(
        service.resetPassword({ token: rawToken, password: 'NewPass123!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(authService.revokeAllSessions).not.toHaveBeenCalled();
    });
  });
});
