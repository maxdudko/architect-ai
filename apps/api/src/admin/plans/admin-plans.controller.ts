import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingMode } from '@prisma/client';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminPlansService } from './admin-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanIndexingLimitsDto } from './dto/update-plan-indexing-limits.dto';
import { UpdatePlanLimitsDto } from './dto/update-plan-limits.dto';
import { UpsertPlanPriceDto } from './dto/upsert-plan-price.dto';

@ApiTags('Admin Plans')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly adminPlansService: AdminPlansService) {}

  @Get()
  @ApiOperation({
    summary: 'List all plans with their prices and usage limits',
  })
  listPlans() {
    return this.adminPlansService.listPlans();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new plan' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.adminPlansService.createPlan(dto);
  }

  @Patch(':planId')
  @ApiOperation({ summary: 'Update plan metadata' })
  updatePlan(@Param('planId') planId: string, @Body() dto: UpdatePlanDto) {
    return this.adminPlansService.updatePlan(planId, dto);
  }

  @Put(':planId/prices/:billingMode')
  @ApiOperation({
    summary: 'Set the standard or BYOK monthly price for a plan',
  })
  upsertPrice(
    @Param('planId') planId: string,
    @Param('billingMode', new ParseEnumPipe(BillingMode))
    billingMode: BillingMode,
    @Body() dto: UpsertPlanPriceDto,
  ) {
    return this.adminPlansService.upsertPrice(planId, billingMode, dto);
  }

  @Get(':planId/limits')
  @ApiOperation({ summary: 'Get plan usage limits' })
  getLimits(@Param('planId') planId: string) {
    return this.adminPlansService.getLimits(planId);
  }

  @Patch(':planId/limits')
  @ApiOperation({ summary: 'Update plan usage limits' })
  updateLimits(
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanLimitsDto,
  ) {
    return this.adminPlansService.updateLimits(planId, dto.limits);
  }

  @Get(':planId/indexing-limits')
  @ApiOperation({ summary: 'Get plan indexing resource limits' })
  getIndexingLimits(@Param('planId') planId: string) {
    return this.adminPlansService.getIndexingLimits(planId);
  }

  @Patch(':planId/indexing-limits')
  @ApiOperation({ summary: 'Update plan indexing resource limits' })
  updateIndexingLimits(
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanIndexingLimitsDto,
  ) {
    return this.adminPlansService.updateIndexingLimits(planId, dto.limits);
  }
}
