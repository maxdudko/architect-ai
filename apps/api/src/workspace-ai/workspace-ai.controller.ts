import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import {
  TestWorkspaceAiKeyDto,
  TestWorkspaceAiKeyResponseDto,
} from './dto/test-workspace-ai-key.dto';
import { UpsertWorkspaceAiSettingsDto } from './dto/upsert-workspace-ai-settings.dto';
import { WorkspaceAiSettingsResponseDto } from './dto/workspace-ai-settings-response.dto';
import { WorkspaceAiService } from './workspace-ai.service';

@ApiTags('Workspace AI')
@ApiBearerAuth()
@Controller('workspaces/:id/ai-settings')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
export class WorkspaceAiController {
  constructor(private readonly workspaceAiService: WorkspaceAiService) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace AI provider settings' })
  getSettings(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.getSettings(workspaceId, user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Connect a workspace OpenAI API key (BYOK)' })
  upsertSettings(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertWorkspaceAiSettingsDto,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.upsertSettings(
      workspaceId,
      user.sub,
      dto.openaiApiKey,
    );
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test a pasted or saved workspace OpenAI API key',
  })
  testApiKey(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: TestWorkspaceAiKeyDto,
  ): Promise<TestWorkspaceAiKeyResponseDto> {
    return this.workspaceAiService.testApiKey(
      workspaceId,
      user.sub,
      dto?.openaiApiKey,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Remove the workspace OpenAI API key (Hosted AI)' })
  deleteSettings(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.deleteSettings(workspaceId, user.sub);
  }
}
