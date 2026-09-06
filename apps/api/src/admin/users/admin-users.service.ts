import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SystemLogCategory, SystemLogLevel, User } from '@prisma/client';
import { AuthService } from '../../auth/auth.service';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { UsersService } from '../../users/users.service';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly systemLogsService: SystemLogsService,
  ) {}

  async updateUser(
    userId: string,
    dto: UpdateAdminUserDto,
    adminId: string,
  ): Promise<User> {
    const user = await this.requireUser(userId);

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await this.usersService.findByEmail(normalizedEmail);
        if (existing && existing.id !== userId) {
          throw new ConflictException('A user with this email already exists');
        }
      }
    }

    const updated = await this.usersService.update(userId, {
      ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.emailVerified !== undefined
        ? { emailVerified: dto.emailVerified }
        : {}),
    });

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'admin.user.update',
      actorType: 'admin',
      actorId: adminId,
      message: 'Admin updated user',
      metadata: {
        userId,
        email: updated.email,
        changes: {
          email: dto.email !== undefined,
          firstName: dto.firstName !== undefined,
          lastName: dto.lastName !== undefined,
          emailVerified: dto.emailVerified !== undefined,
        },
      },
    });

    return updated;
  }

  async banUser(userId: string, adminId: string): Promise<User> {
    const user = await this.requireUser(userId);
    if (user.deletedAt) {
      return user;
    }

    const banned = await this.usersService.softDelete(userId);
    await this.authService.revokeAllSessions(userId);

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.WARN,
      event: 'admin.user.ban',
      actorType: 'admin',
      actorId: adminId,
      message: 'Admin banned user',
      metadata: { userId, email: banned.email },
    });

    return banned;
  }

  async unbanUser(userId: string, adminId: string): Promise<User> {
    const user = await this.requireUser(userId);
    if (!user.deletedAt) {
      return user;
    }

    const restored = await this.usersService.restore(userId);

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'admin.user.unban',
      actorType: 'admin',
      actorId: adminId,
      message: 'Admin unbanned user',
      metadata: { userId, email: restored.email },
    });

    return restored;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
