import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAnalyticsPaginationQueryDto } from '../analytics/dto/admin-analytics-query.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminUsageService } from './admin-usage.service';
import { AssignWorkspacePlanDto } from './dto/assign-workspace-plan.dto';

@ApiTags('Admin Usage')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/usage')
export class AdminUsageController {
  constructor(private readonly adminUsageService: AdminUsageService) {}

  @Get('workspaces')
  @ApiOperation({ summary: 'List workspace usage against plan limits' })
  listWorkspaces(@Query() query: AdminAnalyticsPaginationQueryDto) {
    return this.adminUsageService.listWorkspaces({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
  }

  @Patch('workspaces/:workspaceId/plan')
  @ApiOperation({
    summary:
      "Manually assign a workspace's plan (e.g. Enterprise contact-sales), bypassing Stripe checkout",
  })
  assignPlan(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AssignWorkspacePlanDto,
  ) {
    return this.adminUsageService.assignPlan(workspaceId, dto.planId);
  }
}
