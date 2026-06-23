import { Injectable } from '@nestjs/common';
import {
  Membership,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MembershipUncheckedCreateInput): Promise<Membership> {
    return this.prisma.membership.create({ data });
  }

  findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  listWorkspaceMembers(workspaceId: string): Promise<
    Array<{
      id: string;
      role: WorkspaceRole;
      status: MembershipStatus;
      joinedAt: Date;
      lastSeenAt: Date | null;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
      };
    }>
  > {
    return this.prisma.membership.findMany({
      where: {
        workspaceId,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] },
      },
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setRoleAndStatus(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    status: MembershipStatus,
  ): Promise<Membership> {
    return this.prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      update: {
        role,
        status,
      },
      create: {
        workspaceId,
        userId,
        role,
        status,
      },
    });
  }

  async removeMember(
    workspaceId: string,
    membershipId: string,
  ): Promise<number> {
    const result = await this.prisma.membership.updateMany({
      where: { id: membershipId, workspaceId },
      data: { status: MembershipStatus.REMOVED },
    });

    return result.count;
  }
}
