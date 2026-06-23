import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInvitationDto } from '../memberships/dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitation')
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('workspaces/:id/invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.acceptInvitation(token, dto);
  }
}
