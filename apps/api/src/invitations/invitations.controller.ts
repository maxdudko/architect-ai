import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { AuthCookieService } from '../auth/auth-cookie.service';
import { toPublicAuthResponse } from '../auth/interfaces/public-auth-response.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInvitationDto } from '../memberships/dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import {
  InvitationDeliveryDto,
  InvitationListItemDto,
} from './dto/invitation-list-item.dto';
import { InvitationPreviewDto } from './dto/invitation-preview.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitation')
@Controller()
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Get('workspaces/:id/invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'List pending workspace invitations' })
  listInvitations(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<InvitationListItemDto[]> {
    return this.invitationsService.listInvitations(workspaceId, user.sub);
  }

  @Post('workspaces/:id/invitations')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Invite a member to a workspace' })
  createInvitation(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationDeliveryDto> {
    return this.invitationsService.createInvitation(
      workspaceId,
      user.sub,
      dto.email,
      dto.role,
    );
  }

  @Post('workspaces/:id/invitations/:invitationId/resend')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Resend a workspace invitation email' })
  resendInvitation(
    @Param('id') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<InvitationDeliveryDto> {
    return this.invitationsService.resendInvitation(
      workspaceId,
      user.sub,
      invitationId,
    );
  }

  @Get('invitations/:token')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Preview a workspace invitation' })
  getInvitationPreview(
    @Param('token') token: string,
  ): Promise<InvitationPreviewDto> {
    return this.invitationsService.getInvitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitationsService.acceptInvitation(token, dto);
    this.authCookieService.setRefreshTokenCookie(response, result.refreshToken);
    return toPublicAuthResponse(result);
  }
}
