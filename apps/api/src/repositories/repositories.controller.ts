import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { CreateRepositoryDto } from './dto/create-repository.dto';
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
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.getRepository(workspaceId, repositoryId);
  }

  @Post()
  @ApiOperation({ summary: 'Connect a repository to a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createRepository(
    @Param('id') workspaceId: string,
    @Body() dto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.createRepository(workspaceId, dto);
  }

  @Patch(':repositoryId')
  @ApiOperation({ summary: 'Update a repository in a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @Body() dto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    return this.repositoriesService.updateRepository(
      workspaceId,
      repositoryId,
      dto,
    );
  }

  @Delete(':repositoryId')
  @ApiOperation({ summary: 'Disconnect a repository from a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  async deleteRepository(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<{ success: boolean }> {
    return this.repositoriesService.deleteRepository(workspaceId, repositoryId);
  }
}
