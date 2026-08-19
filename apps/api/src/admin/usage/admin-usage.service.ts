import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsageService } from '../../usage/usage.service';

@Injectable()
export class AdminUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  async listWorkspaces(params: {
    page: number;
    pageSize: number;
    search?: string;
  }) {
    const search = params.search?.trim();
    const where: Prisma.WorkspaceWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, workspaces] = await Promise.all([
      this.prisma.workspace.count({ where }),
      this.prisma.workspace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
          aiSettings: {
            select: { activeProvider: true },
          },
        },
      }),
    ]);

    const items = await Promise.all(
      workspaces.map(async (workspace) => {
        const usage = await this.usageService.getWorkspaceUsage(workspace.id);
        return {
          workspaceId: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          createdAt: workspace.createdAt,
          aiMode: workspace.aiSettings?.activeProvider ? 'BYOK' : 'HOSTED',
          metrics: usage.metrics,
        };
      }),
    );

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }
}
