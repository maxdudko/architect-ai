import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../../common/guards/workspace-param.guard';
import { DependencyMapService } from './dependency-map.service';
import {
  DependencyEvidenceQueryDto,
  ModuleDetailQueryDto,
} from './dto/dependency-map-query.dto';
import type {
  DependencyEvidenceResponseDto,
  DependencyMapResponseDto,
  ModuleDetailResponseDto,
} from './dto/dependency-map-response.dto';

/**
 * Read-only Dependency Mapping surface (spec UI-9).
 *
 * Authorization matches the existing indexed-content reads: workspace
 * membership and role, not a live provider access check (spec FR-1, SEC-2).
 * Every role that can already read indexed files and symbols, including the
 * read-only role, can read the dependency view (spec SEC-3).
 */
@ApiTags('Architecture')
@ApiBearerAuth()
@Controller('workspaces/:id/repositories/:repositoryId/architecture')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class DependencyMapController {
  constructor(private readonly dependencyMapService: DependencyMapService) {}

  @Get('dependency-map')
  @ApiOperation({
    summary: 'Get the module dependency view for a repository revision',
  })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  getDependencyMap(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<DependencyMapResponseDto> {
    return this.dependencyMapService.getDependencyMap(
      workspaceId,
      repositoryId,
    );
  }

  @Get('dependency-map/module')
  @ApiOperation({
    summary: 'Get a module with its direct dependencies and dependents',
  })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  getModuleDetail(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @Query() query: ModuleDetailQueryDto,
  ): Promise<ModuleDetailResponseDto> {
    return this.dependencyMapService.getModuleDetail(
      workspaceId,
      repositoryId,
      query.key,
    );
  }

  @Get('dependency-map/evidence')
  @ApiOperation({
    summary: 'Get source evidence behind a module dependency',
  })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  getDependencyEvidence(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @Query() query: DependencyEvidenceQueryDto,
  ): Promise<DependencyEvidenceResponseDto> {
    return this.dependencyMapService.getDependencyEvidence(
      workspaceId,
      repositoryId,
      query.from,
      query.to,
    );
  }
}
