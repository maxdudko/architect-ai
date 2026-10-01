import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../../common/guards/workspace-param.guard';
import {
  ArchitectureOverviewRunDto,
  SystemOverviewResponseDto,
} from './dto/system-overview.dto';
import { SystemOverviewService } from './system-overview.service';

const READ_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

const GENERATE_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
] as const;

/**
 * System Overview reads and generation requests.
 * Generation follows the guide role model. Reading includes the read-only role.
 */
@ApiTags('Architecture')
@ApiBearerAuth()
@Controller('workspaces/:id/repositories/:repositoryId/architecture/overview')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class SystemOverviewController {
  constructor(private readonly systemOverviewService: SystemOverviewService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the current system overview for a repository',
  })
  @ApiOkResponse({ type: SystemOverviewResponseDto })
  @Roles(...READ_ROLES)
  getOverview(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<SystemOverviewResponseDto> {
    return this.systemOverviewService.getOverview(workspaceId, repositoryId);
  }

  @Post('generations')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue system overview generation' })
  @ApiAcceptedResponse({ type: ArchitectureOverviewRunDto })
  @Roles(...GENERATE_ROLES)
  generate(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<ArchitectureOverviewRunDto> {
    return this.systemOverviewService.requestGeneration(
      workspaceId,
      repositoryId,
      false,
    );
  }

  @Post('generations/regenerate')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue system overview regeneration' })
  @ApiAcceptedResponse({ type: ArchitectureOverviewRunDto })
  @Roles(...GENERATE_ROLES)
  regenerate(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<ArchitectureOverviewRunDto> {
    return this.systemOverviewService.requestGeneration(
      workspaceId,
      repositoryId,
      true,
    );
  }
}
