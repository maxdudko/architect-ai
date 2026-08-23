import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SystemLog,
  SystemLogCategory,
  SystemLogLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SystemLogCreateInput {
  category: SystemLogCategory;
  level?: SystemLogLevel;
  event: string;
  message?: string | null;
  requestId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  workspaceId?: string | null;
  repositoryId?: string | null;
  method?: string | null;
  route?: string | null;
  statusCode?: number | null;
  latencyMs?: number | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface SystemLogListParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: SystemLogCategory;
  level?: SystemLogLevel;
  from?: Date;
  to?: Date;
  excludeOptions?: boolean;
}

@Injectable()
export class SystemLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: SystemLogCreateInput): Promise<SystemLog> {
    return this.prisma.systemLog.create({
      data: {
        category: data.category,
        level: data.level ?? SystemLogLevel.INFO,
        event: data.event,
        message: data.message ?? null,
        requestId: data.requestId ?? null,
        actorType: data.actorType ?? null,
        actorId: data.actorId ?? null,
        workspaceId: data.workspaceId ?? null,
        repositoryId: data.repositoryId ?? null,
        method: data.method ?? null,
        route: data.route ?? null,
        statusCode: data.statusCode ?? null,
        latencyMs: data.latencyMs ?? null,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async findManyPaginated(
    params: SystemLogListParams,
  ): Promise<{ items: SystemLog[]; total: number }> {
    const where: Prisma.SystemLogWhereInput = {};

    if (params.category) {
      where.category = params.category;
    }
    if (params.level) {
      where.level = params.level;
    }
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      };
    }

    const search = params.search?.trim();
    if (search) {
      where.OR = [
        { event: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
        { route: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (params.excludeOptions) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [{ method: null }, { method: { not: 'OPTIONS' } }],
        },
      ];
    }

    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.pageSize,
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { items, total };
  }
}
