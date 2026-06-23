import { Injectable } from '@nestjs/common';
import { Invitation, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation> {
    return this.prisma.invitation.create({ data });
  }

  findActiveByToken(token: string): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: {
        token,
        deletedAt: null,
        acceptedAt: null,
      },
    });
  }

  findPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string,
  ): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAccepted(id: string): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }
}
