import { Injectable } from '@nestjs/common';
import { Invitation, InvitationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_INVITATION_WHERE = {
  status: InvitationStatus.PENDING,
  deletedAt: null,
} satisfies Prisma.InvitationWhereInput;

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation> {
    return this.prisma.invitation.create({ data });
  }

  findPendingByToken(token: string): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: {
        token,
        ...OPEN_INVITATION_WHERE,
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
        ...OPEN_INVITATION_WHERE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markAccepted(id: string): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });
  }

  markExpired(id: string): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.EXPIRED },
    });
  }
}
