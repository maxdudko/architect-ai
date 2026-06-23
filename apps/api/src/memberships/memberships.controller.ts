import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { MembershipsService } from './memberships.service';

@ApiTags('Membership')
@ApiBearerAuth()
@Controller('workspaces/:id/members')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  @ApiOperation({ summary: 'List workspace members' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  listMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.membershipsService.listMembers(workspaceId, user.sub);
  }

  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove member from workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ success: boolean }> {
    await this.membershipsService.removeMember(workspaceId, memberId, user.sub);
    return { success: true };
  }
}
