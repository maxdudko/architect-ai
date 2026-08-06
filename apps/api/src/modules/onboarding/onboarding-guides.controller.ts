import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../common/guards/workspace-param.guard';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { GenerateGuidesDto } from './dto/generate-guides.dto';
import { GenerationRunResponseDto } from './dto/generation-run-response.dto';
import { ListGuidesQueryDto } from './dto/list-guides-query.dto';
import {
  OnboardingGuideListResponseDto,
  OnboardingGuideResponseDto,
} from './dto/onboarding-guide-response.dto';
import { OnboardingGuidesService } from './onboarding-guides.service';

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

@ApiTags('Onboarding Guides')
@ApiBearerAuth()
@Controller('workspaces/:id/repositories/:repositoryId/guides')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class OnboardingGuidesController {
  constructor(
    private readonly onboardingGuidesService: OnboardingGuidesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List living onboarding guides' })
  @ApiOkResponse({ type: OnboardingGuideListResponseDto })
  @Roles(...READ_ROLES)
  listGuides(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListGuidesQueryDto,
  ): Promise<OnboardingGuideListResponseDto> {
    return this.onboardingGuidesService.listGuides(
      workspaceId,
      repositoryId,
      user.sub,
      query.type,
      query.q,
    );
  }

  @Get('generation-runs/latest')
  @ApiOperation({ summary: 'Get the latest guide generation run' })
  @ApiOkResponse({ type: GenerationRunResponseDto })
  @Roles(...READ_ROLES)
  getLatestGenerationRun(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<GenerationRunResponseDto | null> {
    return this.onboardingGuidesService.getLatestGenerationRun(
      workspaceId,
      repositoryId,
      user.sub,
    );
  }

  @Get(':guideId')
  @ApiOperation({ summary: 'Get a living onboarding guide' })
  @ApiOkResponse({ type: OnboardingGuideResponseDto })
  @Roles(...READ_ROLES)
  getGuide(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @Param('guideId') guideId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<OnboardingGuideResponseDto> {
    return this.onboardingGuidesService.getGuide(
      workspaceId,
      repositoryId,
      guideId,
      user.sub,
    );
  }

  @Post('generate')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue living onboarding guide generation' })
  @ApiAcceptedResponse({ type: GenerationRunResponseDto })
  @Roles(...GENERATE_ROLES)
  generateGuides(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateGuidesDto = {},
  ): Promise<GenerationRunResponseDto> {
    return this.onboardingGuidesService.generateGuides(
      workspaceId,
      repositoryId,
      user.sub,
      dto.types,
    );
  }

  @Post('regenerate')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue living onboarding guide regeneration' })
  @ApiAcceptedResponse({ type: GenerationRunResponseDto })
  @Roles(...GENERATE_ROLES)
  regenerateGuides(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: GenerateGuidesDto = {},
  ): Promise<GenerationRunResponseDto> {
    return this.onboardingGuidesService.regenerateGuides(
      workspaceId,
      repositoryId,
      user.sub,
      dto.types,
    );
  }
}
