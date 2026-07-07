import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Repository,
  RepositoryProvider,
  RepositoryStatus,
} from '@prisma/client';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryResponseDto } from './dto/repository-response.dto';
import { RetryIndexingDto } from './dto/retry-indexing.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoryEmbeddingService } from './indexing/repository-embedding.service';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoriesRepository } from './repositories.repository';

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);
  private static readonly ACTIVE_INDEXING_STATUSES = new Set<RepositoryStatus>([
    RepositoryStatus.PENDING,
    RepositoryStatus.CLONING,
    RepositoryStatus.PARSING,
    RepositoryStatus.CHUNKING,
    RepositoryStatus.EMBEDDING,
  ]);

  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly repositoryIndexingQueueService: RepositoryIndexingQueueService,
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
    private readonly embeddingService: RepositoryEmbeddingService,
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
    userId: string,
    dto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    const existingActive =
      await this.repositoriesRepository.findByProviderAndExternalId(
        dto.provider,
        dto.externalId,
      );

    if (existingActive) {
      if (existingActive.workspaceId === workspaceId) {
        throw new ConflictException(
          'This repository is already connected to this workspace',
        );
      }
      throw new ConflictException(
        'This repository is already connected to another workspace',
      );
    }

    const metadata = await this.resolveRepositoryMetadata(userId, dto);
    const existing =
      await this.repositoriesRepository.findAnyByProviderAndExternalId(
        dto.provider,
        dto.externalId,
      );

    if (existing?.deletedAt && existing.workspaceId !== workspaceId) {
      throw new ConflictException(
        'This repository is already connected to another workspace',
      );
    }

    const repository = existing?.deletedAt
      ? await this.repositoriesRepository.restore(workspaceId, existing.id, {
          owner: metadata.owner,
          name: metadata.name,
          fullName: metadata.fullName,
          defaultBranch: metadata.defaultBranch,
          status: RepositoryStatus.PENDING,
          lastIndexedAt: null,
          indexingError: null,
        })
      : await this.repositoriesRepository.create(workspaceId, {
          provider: dto.provider,
          externalId: dto.externalId,
          owner: metadata.owner,
          name: metadata.name,
          fullName: metadata.fullName,
          defaultBranch: metadata.defaultBranch,
        });

    if (!repository) {
      throw new ConflictException(
        'This repository is already connected to another workspace',
      );
    }

    const queuedRepository = await this.enqueueOrMarkFailed({
      workspaceId,
      repositoryId: repository.id,
      branch: dto.indexBranch ?? metadata.defaultBranch,
      userId,
      operation: 'initial',
    });

    return this.toResponse(queuedRepository ?? repository);
  }

  private async resolveRepositoryMetadata(
    userId: string,
    dto: CreateRepositoryDto,
  ): Promise<{
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
  }> {
    if (dto.provider !== RepositoryProvider.GITHUB) {
      return {
        owner: dto.owner,
        name: dto.name,
        fullName: dto.fullName,
        defaultBranch: dto.defaultBranch ?? 'main',
      };
    }

    const repository =
      await this.githubAccessTokenService.executeWithAccessToken(
        userId,
        (accessToken) =>
          this.githubHttpService.getRepositoryById(accessToken, dto.externalId),
      );

    if (!repository.owner?.login || !repository.name || !repository.full_name) {
      throw new BadRequestException('GitHub repository payload is incomplete');
    }

    return {
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch || 'main',
    };
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

    try {
      await this.embeddingService.deleteRepositoryVectors(repositoryId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown cleanup failure';
      this.logger.warn(
        `Repository ${repositoryId} disconnected but vector cleanup failed: ${message}`,
      );
    }

    return { success: true };
  }

  async retryIndexing(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    dto: RetryIndexingDto = {},
  ): Promise<RepositoryResponseDto> {
    const repository = await this.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );
    this.assertNotIndexingInProgress(repository);
    if (repository.status !== RepositoryStatus.FAILED) {
      throw new BadRequestException(
        'Retry is only available for failed repositories',
      );
    }

    return this.startIndexing(workspaceId, repository, userId, {
      branch: dto.branch ?? repository.defaultBranch,
      operation: 'retry',
    });
  }

  async reindexRepository(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    dto: RetryIndexingDto = {},
  ): Promise<RepositoryResponseDto> {
    const repository = await this.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );
    this.assertNotIndexingInProgress(repository);
    if (repository.status !== RepositoryStatus.READY) {
      throw new BadRequestException(
        'Reindex is only available for repositories that are ready',
      );
    }

    return this.startIndexing(workspaceId, repository, userId, {
      branch: dto.branch ?? repository.defaultBranch,
      operation: 'reindex',
    });
  }

  private async startIndexing(
    workspaceId: string,
    repository: Repository,
    userId: string,
    params: {
      branch: string;
      operation: 'retry' | 'reindex';
    },
  ): Promise<RepositoryResponseDto> {
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

    const queuedRepository = await this.enqueueOrMarkFailed({
      workspaceId,
      repositoryId: repository.id,
      branch: params.branch,
      userId,
      operation: params.operation,
    });

    return this.toResponse(queuedRepository ?? updated);
  }

  private async enqueueOrMarkFailed(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch: string;
    operation: 'initial' | 'retry' | 'reindex';
  }): Promise<Repository | null> {
    if (!this.repositoryIndexingQueueService.isReady()) {
      this.logger.warn(
        `Repository indexing queue unavailable; marking ${params.repositoryId} as failed (${params.operation})`,
      );
      return this.repositoriesRepository.updateStatus(
        params.workspaceId,
        params.repositoryId,
        {
          status: RepositoryStatus.FAILED,
          indexingError:
            'Indexing queue is currently unavailable. Please retry in a moment.',
          lastIndexedAt: null,
        },
      );
    }

    try {
      if (params.operation === 'initial') {
        await this.repositoryIndexingQueueService.enqueueInitialIndexing({
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          userId: params.userId,
          branch: params.branch,
        });
      } else if (params.operation === 'retry') {
        await this.repositoryIndexingQueueService.enqueueRetryIndexing({
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          userId: params.userId,
          branch: params.branch,
        });
      } else {
        await this.repositoryIndexingQueueService.enqueueManualReindex({
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          userId: params.userId,
          branch: params.branch,
        });
      }
      return null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Queue is unavailable';
      this.logger.error(
        `Failed to enqueue repository indexing (${params.operation}) for ${params.repositoryId}: ${message}`,
      );
      return this.repositoriesRepository.updateStatus(
        params.workspaceId,
        params.repositoryId,
        {
          status: RepositoryStatus.FAILED,
          indexingError:
            'Indexing queue is currently unavailable. Please retry in a moment.',
          lastIndexedAt: null,
        },
      );
    }
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

  private assertNotIndexingInProgress(repository: Repository): void {
    if (RepositoriesService.ACTIVE_INDEXING_STATUSES.has(repository.status)) {
      throw new ConflictException(
        'Repository indexing is already in progress for this repository',
      );
    }
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
