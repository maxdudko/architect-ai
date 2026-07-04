import { Injectable } from '@nestjs/common';
import { OAuthAccount, OAuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GithubAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: OAuthProvider.GITHUB,
        deletedAt: null,
      },
    });
  }

  findByProviderUserId(providerUserId: string): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findFirst({
      where: {
        provider: OAuthProvider.GITHUB,
        providerUserId,
        deletedAt: null,
      },
    });
  }

  upsertGithubAccount(params: {
    userId: string;
    providerUserId: string;
    login: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string;
    tokenExpiresAt?: Date;
  }): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.upsert({
      where: {
        userId_provider: {
          userId: params.userId,
          provider: OAuthProvider.GITHUB,
        },
      },
      create: {
        userId: params.userId,
        provider: OAuthProvider.GITHUB,
        providerUserId: params.providerUserId,
        login: params.login,
        accessTokenEncrypted: params.accessTokenEncrypted,
        refreshTokenEncrypted: params.refreshTokenEncrypted,
        tokenExpiresAt: params.tokenExpiresAt,
      },
      update: {
        providerUserId: params.providerUserId,
        login: params.login,
        accessTokenEncrypted: params.accessTokenEncrypted,
        refreshTokenEncrypted: params.refreshTokenEncrypted,
        tokenExpiresAt: params.tokenExpiresAt,
        deletedAt: null,
      },
    });
  }

  async softDeleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.oAuthAccount.updateMany({
      where: {
        userId,
        provider: OAuthProvider.GITHUB,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count;
  }
}
