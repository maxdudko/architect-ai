import { Injectable } from '@nestjs/common';
import { PasswordResetToken, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PasswordResetTokenWithUser = PasswordResetToken & { user: User };

@Injectable()
export class PasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  findValidByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenWithUser | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null },
      },
      include: { user: true },
    });
  }

  invalidateUnusedForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async consumeForReset(params: {
    tokenId: string;
    userId: string;
    passwordHash: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: params.tokenId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.passwordHash,
          emailVerified: true,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: params.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return true;
    });
  }
}
