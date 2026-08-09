import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  AdminAnalyticsPaginationQueryDto,
  AdminActiveUsageQueryDto,
  AdminRepositoryEventsQueryDto,
} from './dto/admin-analytics-query.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Analytics KPI overview' })
  getOverview() {
    return this.adminAnalyticsService.getOverview();
  }

  @Get('repository-events')
  @ApiOperation({ summary: 'List repository connection/indexing events' })
  listRepositoryEvents(@Query() query: AdminRepositoryEventsQueryDto) {
    return this.adminAnalyticsService.listRepositoryEvents({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      workspaceId: query.workspaceId,
      type: query.type,
    });
  }

  @Get('questions')
  @ApiOperation({ summary: 'List asked questions' })
  listQuestions(@Query() query: AdminAnalyticsPaginationQueryDto) {
    return this.adminAnalyticsService.listQuestions({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      workspaceId: query.workspaceId,
    });
  }

  @Get('sources')
  @ApiOperation({ summary: 'List top cited sources' })
  listSources(@Query() query: AdminAnalyticsPaginationQueryDto) {
    return this.adminAnalyticsService.listSources({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      workspaceId: query.workspaceId,
    });
  }

  @Get('feedback')
  @ApiOperation({ summary: 'List answer feedback' })
  listFeedback(@Query() query: AdminAnalyticsPaginationQueryDto) {
    return this.adminAnalyticsService.listFeedback({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      workspaceId: query.workspaceId,
    });
  }

  @Get('token-usage')
  @ApiOperation({
    summary: 'List token usage (cost proxy) by workspace',
  })
  listTokenUsage(@Query() query: AdminAnalyticsPaginationQueryDto) {
    return this.adminAnalyticsService.listTokenUsage({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      workspaceId: query.workspaceId,
    });
  }

  @Get('active-usage')
  @ApiOperation({
    summary: 'List daily active users (UTC) for the last N days',
  })
  listActiveUsage(@Query() query: AdminActiveUsageQueryDto) {
    return this.adminAnalyticsService.listActiveUsage({
      page: query.page,
      pageSize: query.pageSize,
      days: query.days,
    });
  }
}
