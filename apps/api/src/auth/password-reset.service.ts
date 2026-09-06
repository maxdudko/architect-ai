import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SystemLogCategory, SystemLogLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetTokensRepository } from './password-reset-tokens.repository';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from './password-reset.utils';

const RESET_TTL_MS = 1000 * 60 * 60;
const INVALID_RESET_LINK = 'This reset link is invalid or has expired';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly systemLogsService: SystemLogsService,
  ) {}

  async requestReset(email: string): Promise<{ success: true }> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || user.deletedAt) {
      this.systemLogsService.record({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.INFO,
        event: 'user.auth.password_reset.request',
        message: 'Password reset requested for unknown or deleted account',
        metadata: { email: normalizedEmail },
      });
      return { success: true };
    }

    if (!user.passwordHash) {
      this.systemLogsService.record({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.INFO,
        event: 'user.auth.password_reset.request',
        actorType: 'user',
        actorId: user.id,
        message: 'Password reset requested for OAuth-only account',
        metadata: { email: normalizedEmail },
      });
      await this.deliverOauthReminder(user.email);
      return { success: true };
    }

    await this.passwordResetTokensRepository.invalidateUnusedForUser(user.id);

    const token = generatePasswordResetToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.passwordResetTokensRepository.create({
      userId: user.id,
      tokenHash: hashPasswordResetToken(token),
      expiresAt,
    });

    await this.deliverResetEmail(user.email, token, expiresAt);

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'user.auth.password_reset.request',
      actorType: 'user',
      actorId: user.id,
      message: 'Password reset email issued',
      metadata: { email: normalizedEmail },
    });

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const record =
      await this.passwordResetTokensRepository.findValidByTokenHash(
        hashPasswordResetToken(dto.token),
      );

    if (!record || !record.user.passwordHash) {
      this.systemLogsService.record({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.WARN,
        event: 'user.auth.password_reset.failure',
        message: 'Invalid or expired password reset token',
      });
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const consumed = await this.passwordResetTokensRepository.consumeForReset({
      tokenId: record.id,
      userId: record.userId,
      passwordHash,
    });

    if (!consumed) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    await this.authService.revokeAllSessions(record.userId);

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'user.auth.password_reset.success',
      actorType: 'user',
      actorId: record.userId,
      message: 'User reset password',
      metadata: { email: record.user.email },
    });

    return { success: true };
  }

  private async deliverResetEmail(
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const resetUrl = this.mailService.buildPasswordResetUrl(token);
    try {
      await this.mailService.sendPasswordReset({
        to: email,
        resetUrl,
        expiresAt,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${String(error)}`,
      );
    }
  }

  private async deliverOauthReminder(email: string): Promise<void> {
    try {
      await this.mailService.sendOauthSignInReminder({ to: email });
    } catch (error) {
      this.logger.error(
        `Failed to send OAuth sign-in reminder to ${email}: ${String(error)}`,
      );
    }
  }
}
