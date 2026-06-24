import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInvitationDto } from '../memberships/dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationListItemDto } from './dto/invitation-list-item.dto';
import { InvitationPreviewDto } from './dto/invitation-preview.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitation')
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Invite a member to a workspace' })
  createInvitation(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.createInvitation(
      workspaceId,
      user.sub,
      dto.email,
      dto.role,
    );
  }

  @Post('workspaces/:id/invitations/:invitationId/resend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Resend a workspace invitation email' })
  resendInvitation(
    @Param('id') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invitationsService.resendInvitation(
      workspaceId,
      user.sub,
      invitationId,
    );
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview a workspace invitation' })
  getInvitationPreview(
    @Param('token') token: string,
  ): Promise<InvitationPreviewDto> {
    return this.invitationsService.getInvitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.acceptInvitation(token, dto);
  }
}
