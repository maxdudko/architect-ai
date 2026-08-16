import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspacePlan } from '@prisma/client';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { UpdatePlanLimitsDto } from './dto/update-plan-limits.dto';
import { AdminPlansService } from './admin-plans.service';

@ApiTags('Admin Plans')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly adminPlansService: AdminPlansService) {}

  @Get(':plan/limits')
  @ApiOperation({ summary: 'Get plan usage limits' })
  getLimits(@Param('plan') plan: WorkspacePlan) {
    return this.adminPlansService.getLimits(plan);
  }

  @Patch(':plan/limits')
  @ApiOperation({ summary: 'Update plan usage limits' })
  updateLimits(
    @Param('plan') plan: WorkspacePlan,
    @Body() dto: UpdatePlanLimitsDto,
  ) {
    return this.adminPlansService.updateLimits(plan, dto.limits);
  }
}
