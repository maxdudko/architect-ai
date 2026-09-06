import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiProvider, WorkspaceRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { SetActiveAiProviderDto } from './dto/set-active-ai-provider.dto';
import {
  TestWorkspaceAiCredentialDto,
  TestWorkspaceAiKeyResponseDto,
} from './dto/test-workspace-ai-credential.dto';
import { UpsertWorkspaceAiCredentialDto } from './dto/upsert-workspace-ai-credential.dto';
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

  @Put('credentials')
  @ApiOperation({
    summary: 'Save (or replace) a workspace API key for a provider (BYOK)',
  })
  upsertCredential(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertWorkspaceAiCredentialDto,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.upsertCredential(
      workspaceId,
      user.sub,
      dto.provider,
      dto.apiKey,
    );
  }

  @Delete('credentials/:provider')
  @ApiOperation({ summary: 'Remove a saved workspace API key for a provider' })
  deleteCredential(
    @Param('id') workspaceId: string,
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.deleteCredential(
      workspaceId,
      user.sub,
      provider,
    );
  }

  @Post('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Switch the active AI provider without re-entering a key (or switch to Hosted AI)',
  })
  setActiveProvider(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SetActiveAiProviderDto,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    return this.workspaceAiService.setActiveProvider(
      workspaceId,
      user.sub,
      dto.provider,
    );
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test a pasted or saved workspace API key for a provider',
  })
  testCredential(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: TestWorkspaceAiCredentialDto,
  ): Promise<TestWorkspaceAiKeyResponseDto> {
    return this.workspaceAiService.testCredential(
      workspaceId,
      user.sub,
      dto.provider,
      dto.apiKey,
    );
  }
}
