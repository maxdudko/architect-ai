import { Injectable } from '@nestjs/common';
import { IdentityAccount, IdentityProvider, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type IdentityAccountWithUser = IdentityAccount & { user: User };

@Injectable()
export class IdentityAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProviderUserId(
    provider: IdentityProvider,
    providerUserId: string,
  ): Promise<IdentityAccountWithUser | null> {
    return this.prisma.identityAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: { user: true },
    });
  }

  findByUserAndProvider(
    userId: string,
    provider: IdentityProvider,
  ): Promise<IdentityAccount | null> {
    return this.prisma.identityAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }

  create(params: {
    userId: string;
    provider: IdentityProvider;
    providerUserId: string;
    email?: string | null;
  }): Promise<IdentityAccount> {
    return this.prisma.identityAccount.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        providerUserId: params.providerUserId,
        email: params.email,
      },
    });
  }
}
