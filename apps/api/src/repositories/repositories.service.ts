import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository, RepositoryStatus } from '@prisma/client';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryResponseDto } from './dto/repository-response.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoriesRepository } from './repositories.repository';

@Injectable()
export class RepositoriesService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly repositoryIndexingQueueService: RepositoryIndexingQueueService,
  ) {}

  async listRepositories(
    workspaceId: string,
  ): Promise<RepositoryResponseDto[]> {
    const repositories =
      await this.repositoriesRepository.listByWorkspace(workspaceId);
    return repositories.map((repository) => this.toResponse(repository));
  }

  async getRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryResponseDto> {
    const repository = await this.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );
    return this.toResponse(repository);
  }

  async createRepository(
    workspaceId: string,
    dto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    const existing =
      await this.repositoriesRepository.findByProviderAndExternalId(
        dto.provider,
        dto.externalId,
      );

    if (existing) {
      if (existing.workspaceId === workspaceId) {
        throw new ConflictException(
          'This repository is already connected to this workspace',
        );
      }
      throw new ConflictException(
        'This repository is already connected to another workspace',
      );
    }

    const repository = await this.repositoriesRepository.create(workspaceId, {
      provider: dto.provider,
      externalId: dto.externalId,
      owner: dto.owner,
      name: dto.name,
      fullName: dto.fullName,
      defaultBranch: dto.defaultBranch ?? 'main',
    });

    await this.repositoryIndexingQueueService.enqueueIndexing(
      workspaceId,
      repository.id,
    );

    return this.toResponse(repository);
  }

  async updateRepository(
    workspaceId: string,
    repositoryId: string,
    dto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    await this.findRepositoryInWorkspace(workspaceId, repositoryId);

    const data: { defaultBranch?: string } = {};
    if (dto.defaultBranch !== undefined) {
      data.defaultBranch = dto.defaultBranch;
    }

    const updated = await this.repositoriesRepository.update(
      workspaceId,
      repositoryId,
      data,
    );

    if (!updated) {
      throw new NotFoundException('Repository not found in this workspace');
    }

    return this.toResponse(updated);
  }

  async deleteRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<{ success: boolean }> {
    await this.findRepositoryInWorkspace(workspaceId, repositoryId);

    const deletedCount = await this.repositoriesRepository.softDelete(
      workspaceId,
      repositoryId,
    );

    if (deletedCount === 0) {
      throw new NotFoundException('Repository not found in this workspace');
    }

    return { success: true };
  }

  async retryIndexing(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryResponseDto> {
    const repository = await this.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );

    const updated = await this.repositoriesRepository.updateStatus(
      workspaceId,
      repository.id,
      {
        status: RepositoryStatus.PENDING,
        indexingError: null,
      },
    );
    if (!updated) {
      throw new NotFoundException('Repository not found in this workspace');
    }

    await this.repositoryIndexingQueueService.enqueueIndexing(
      workspaceId,
      repository.id,
    );

    return this.toResponse(updated);
  }

  private async findRepositoryInWorkspace(
    workspaceId: string,
    repositoryId: string,
  ): Promise<Repository> {
    const repository = await this.repositoriesRepository.findById(
      workspaceId,
      repositoryId,
    );

    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }

    return repository;
  }

  private toResponse(repository: Repository): RepositoryResponseDto {
    return {
      id: repository.id,
      workspaceId: repository.workspaceId,
      provider: repository.provider,
      externalId: repository.externalId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      status: repository.status,
      lastIndexedAt: repository.lastIndexedAt?.toISOString() ?? null,
      indexingError: repository.indexingError,
      createdAt: repository.createdAt.toISOString(),
      updatedAt: repository.updatedAt.toISOString(),
    };
  }
}
