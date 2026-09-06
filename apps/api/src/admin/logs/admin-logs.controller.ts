import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemLog } from '@prisma/client';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';

export interface AdminPublicSystemLog {
  id: string;
  category: string;
  level: string;
  event: string;
  message: string | null;
  requestId: string | null;
  actorType: string | null;
  actorId: string | null;
  workspaceId: string | null;
  repositoryId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  metadata: unknown;
  createdAt: Date;
}

@ApiTags('Admin Logs')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List system logs (HTTP + audit)' })
  async list(@Query() query: ListLogsQueryDto): Promise<{
    items: AdminPublicSystemLog[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { items, total } = await this.systemLogsService.findManyPaginated({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      category: query.category,
      level: query.level,
      from: query.from,
      to: query.to,
      excludeOptions: query.excludeOptions,
    });

    return {
      items: items.map((log) => this.sanitizeLog(log)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private sanitizeLog(log: SystemLog): AdminPublicSystemLog {
    return {
      id: log.id,
      category: log.category,
      level: log.level,
      event: log.event,
      message: log.message,
      requestId: log.requestId,
      actorType: log.actorType,
      actorId: log.actorId,
      workspaceId: log.workspaceId,
      repositoryId: log.repositoryId,
      method: log.method,
      route: log.route,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }
}
