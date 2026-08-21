import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { BillingService } from './billing.service';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { WorkspaceBillingResponseDto } from './dto/workspace-billing-response.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('workspaces/:id/billing')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Get the workspace plan and subscription status' })
  getBilling(
    @Param('id') workspaceId: string,
  ): Promise<WorkspaceBillingResponseDto> {
    return this.billingService.getWorkspaceBilling(workspaceId);
  }

  @Post('checkout')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Create a Stripe Checkout session to upgrade the workspace plan',
  })
  createCheckout(
    @Param('id') workspaceId: string,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingService.createCheckoutSession(workspaceId, dto.planId);
  }

  @Post('portal')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary:
      'Create a Stripe billing portal session to manage or cancel billing',
  })
  createPortal(
    @Param('id') workspaceId: string,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingService.createPortalSession(workspaceId);
  }
}
