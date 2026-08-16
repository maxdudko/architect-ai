import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../auth/auth-cookie.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { SwitchWorkspaceDto } from './dto/switch-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspace')
@ApiBearerAuth()
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List workspaces for the authenticated user' })
  getWorkspaces(@CurrentUser() user: RequestUser) {
    return this.workspacesService.listForUser(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  createWorkspace(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.createWorkspaceForUser(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace settings' })
  updateWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(workspaceId, user.sub, dto);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get current workspace usage and plan limits' })
  getWorkspaceUsage(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workspacesService.getWorkspaceUsage(workspaceId, user.sub);
  }

  @Post(':id/switch')
  @ApiOperation({
    summary:
      'Switch active workspace and receive rotated access and refresh tokens',
  })
  async switchWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SwitchWorkspaceDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.resolveRefreshToken(
      request,
      dto.refreshToken,
    );
    const result = await this.authService.switchActiveWorkspace(
      user.sub,
      user.email,
      workspaceId,
      refreshToken,
    );
    this.authCookieService.setRefreshTokenCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      activeWorkspace: result.activeWorkspace,
    };
  }
}
