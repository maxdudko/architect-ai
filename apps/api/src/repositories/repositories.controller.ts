import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeSymbolType, WorkspaceRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CodeSymbolResponseDto } from './dto/code-symbol-response.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryFileResponseDto } from './dto/repository-file-response.dto';
import { RetryIndexingDto } from './dto/retry-indexing.dto';
import { RepositoryResponseDto } from './dto/repository-response.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoriesService } from './repositories.service';

@ApiTags('Repository')
@ApiBearerAuth()
@Controller('workspaces/:id/repositories')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List repositories in a workspace' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  listRepositories(
    @Param('id') workspaceId: string,
  ): Promise<RepositoryResponseDto[]> {
    return this.repositoriesService.listRepositories(workspaceId);
  }

  @Get(':repositoryId/files')
  @ApiOperation({ summary: 'List indexed files for a repository' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  listRepositoryFiles(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Query('pathPrefix') pathPrefix?: string,
  ): Promise<RepositoryFileResponseDto[]> {
    return this.repositoriesService.listRepositoryFiles(
      workspaceId,
      repositoryId,
      user.sub,
      pathPrefix,
    );
  }

  @Get(':repositoryId/symbols')
  @ApiOperation({ summary: 'List extracted symbols for a repository' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  listRepositorySymbols(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Query('filePath') filePath?: string,
    @Query('type') type?: CodeSymbolType,
  ): Promise<CodeSymbolResponseDto[]> {
    return this.repositoriesService.listRepositorySymbols(
      workspaceId,
      repositoryId,
      user.sub,
      { filePath, type },
    );
  }

  @Get(':repositoryId')
  @ApiOperation({ summary: 'Get a repository in a workspace' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  getRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.getRepository(
      workspaceId,
      repositoryId,
      user.sub,
    );
  }

  @Post()
  @RateLimit({ limit: 15, windowMs: 60_000 })
  @ApiOperation({ summary: 'Connect a repository to a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createRepository(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.createRepository(
      workspaceId,
      user.sub,
      dto,
    );
  }

  @Patch(':repositoryId')
  @ApiOperation({ summary: 'Update a repository in a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.updateRepository(
      workspaceId,
      repositoryId,
      user.sub,
      dto,
    );
  }

  @Delete(':repositoryId')
  @ApiOperation({ summary: 'Disconnect a repository from a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  async deleteRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ success: boolean }> {
    return this.repositoriesService.deleteRepository(
      workspaceId,
      repositoryId,
      user.sub,
    );
  }

  @Post(':repositoryId/retry')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Retry repository indexing pipeline' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  retryIndexing(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RetryIndexingDto = {},
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.retryIndexing(
      workspaceId,
      repositoryId,
      user.sub,
      dto,
    );
  }

  @Post(':repositoryId/reindex')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Manually reindex a repository' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  reindexRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RetryIndexingDto = {},
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.reindexRepository(
      workspaceId,
      repositoryId,
      user.sub,
      dto,
    );
  }
}
