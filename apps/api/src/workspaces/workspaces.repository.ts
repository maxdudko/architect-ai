import { Injectable } from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  Workspace,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.WorkspaceUncheckedCreateInput): Promise<Workspace> {
    return this.prisma.workspace.create({ data });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { id },
    });
  }

  findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { slug },
    });
  }

  update(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { id },
      data,
    });
  }

  async listForUser(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      role: WorkspaceRole;
    }>
  > {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    }));
  }
}
