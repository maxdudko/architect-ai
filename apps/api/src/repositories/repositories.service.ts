import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AnalyticsEventType,
  CodeSymbol,
  CodeSymbolType,
  Repository,
  RepositoryFile,
  RepositoryProvider,
  RepositoryStatus,
  UsageMetric,
} from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
import { isIndexingResourceLimitError } from '../usage/indexing-resource-limit.error';
import { IndexingResourceLimitExceededException } from '../usage/indexing-resource-limit.exception';
import { UsageLimitExceededException } from '../usage/usage-limit.exception';
import { UsageService } from '../usage/usage.service';
import { CodeSymbolResponseDto } from './dto/code-symbol-response.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryFileResponseDto } from './dto/repository-file-response.dto';
import { RepositoryResponseDto } from './dto/repository-response.dto';
import { RetryIndexingDto } from './dto/retry-indexing.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { GithubIndexingEstimateService } from './indexing/github-indexing-estimate.service';
import { RepositoryEmbeddingService } from './indexing/repository-embedding.service';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoryAccessValidationService } from './repository-access-validation.service';
import { RepositoriesRepository } from './repositories.repository';

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly repositoryIndexingQueueService: RepositoryIndexingQueueService,
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
    private readonly embeddingService: RepositoryEmbeddingService,
    private readonly repositoryAccessValidationService: RepositoryAccessValidationService,
    private readonly analyticsService: AnalyticsService,
    private readonly usageService: UsageService,
    private readonly githubIndexingEstimateService: GithubIndexingEstimateService,
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
    _userId: string,
  ): Promise<RepositoryResponseDto> {
    const repository = await this.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );
    return this.toResponse(repository);
  }

  async listRepositoryFiles(
    workspaceId: string,
    repositoryId: string,
    _userId: string,
    pathPrefix?: string,
  ): Promise<RepositoryFileResponseDto[]> {
    await this.findRepositoryInWorkspace(workspaceId, repositoryId);
    const files = await this.repositoriesRepository.listCurrentRepositoryFiles(
      repositoryId,
      { pathPrefix },
    );
    return files.map((file) => this.toFileResponse(file));
  }

  async listRepositorySymbols(
    workspaceId: string,
    repositoryId: string,
    _userId: string,
    options?: { filePath?: string; type?: CodeSymbolType },
  ): Promise<CodeSymbolResponseDto[]> {
    await this.findRepositoryInWorkspace(workspaceId, repositoryId);
    const symbols = await this.repositoriesRepository.listCurrentCodeSymbols(
      repositoryId,
      options,
    );
    return symbols.map((symbol) => this.toSymbolResponse(symbol));
  }

  async createRepository(
    workspaceId: string,
    userId: string,
    dto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    await this.usageService.assertWithinLimit(
      workspaceId,
      UsageMetric.REPOSITORIES,
    );
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
    if (dto.provider === RepositoryProvider.GITHUB) {
      await this.assertIndexingResourceLimits({
        workspaceId,
        userId,
        owner: metadata.owner,
        name: metadata.name,
        branch: dto.indexBranch ?? metadata.defaultBranch,
      });
    }
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
          connectedByUserId: userId,
        })
      : await this.repositoriesRepository.create(workspaceId, {
          provider: dto.provider,
          externalId: dto.externalId,
          owner: metadata.owner,
          name: metadata.name,
          fullName: metadata.fullName,
          defaultBranch: metadata.defaultBranch,
          connectedByUserId: userId,
        });

    if (!repository) {
      throw new ConflictException(
        'This repository is already connected to another workspace',
      );
    }

    await this.analyticsService.recordEvent({
      type: AnalyticsEventType.REPOSITORY_CONNECTED,
      workspaceId,
      actorUserId: userId,
      repositoryId: repository.id,
      payload: {
        fullName: repository.fullName,
        provider: repository.provider,
      },
    });

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
      defaultBranch: dto.defaultBranch ?? (repository.default_branch || 'main'),
    };
  }

  async updateRepository(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    dto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });

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
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });

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
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });
    await this.assertNotIndexingInProgress(repository);
    if (repository.status === RepositoryStatus.FAILED) {
      return this.startIndexing(workspaceId, repository, userId, {
        branch: dto.branch ?? repository.defaultBranch,
        operation: 'retry',
      });
    }
    if (repository.status === RepositoryStatus.PENDING) {
      const previousSuccess =
        await this.repositoriesRepository.hasSucceededIndexingRun(repositoryId);
      if (previousSuccess) {
        throw new ConflictException(
          'Repository indexing is already in progress for this repository',
        );
      }
      return this.startIndexing(workspaceId, repository, userId, {
        branch: dto.branch ?? repository.defaultBranch,
        operation: 'retry',
      });
    }

    throw new BadRequestException(
      'Retry is only available for failed or stuck pending repositories',
    );
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
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });
    await this.assertNotIndexingInProgress(repository);
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
    if (repository.provider === RepositoryProvider.GITHUB) {
      await this.assertIndexingResourceLimits({
        workspaceId,
        userId,
        owner: repository.owner,
        name: repository.name,
        branch: params.branch,
      });
    }
    await this.usageService.assertWithinLimit(
      workspaceId,
      UsageMetric.INDEXING_RUNS,
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

    const queuedRepository = await this.enqueueOrMarkFailed({
      workspaceId,
      repositoryId: repository.id,
      branch: params.branch,
      userId,
      operation: params.operation,
      previousStatus: repository.status,
    });

    return this.toResponse(queuedRepository ?? updated);
  }

  private async enqueueOrMarkFailed(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
    branch: string;
    operation: 'initial' | 'retry' | 'reindex';
    previousStatus?: RepositoryStatus;
  }): Promise<Repository | null> {
    try {
      await this.usageService.assertWithinLimit(
        params.workspaceId,
        UsageMetric.INDEXING_RUNS,
      );
    } catch (error) {
      if (error instanceof UsageLimitExceededException) {
        await this.restoreAfterIndexingLimit(params, error.message);
        throw error;
      }
      throw error;
    }
    if (!this.repositoryIndexingQueueService.isReady()) {
      this.logger.warn(
        `Repository indexing queue unavailable; marking ${params.repositoryId} as failed (${params.operation})`,
      );
      return this.markIndexingUnavailable(
        params.workspaceId,
        params.repositoryId,
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
      return this.markIndexingUnavailable(
        params.workspaceId,
        params.repositoryId,
      );
    }
  }

  private async markIndexingUnavailable(
    workspaceId: string,
    repositoryId: string,
  ): Promise<Repository | null> {
    const previousSuccess =
      await this.repositoriesRepository.hasSucceededIndexingRun(repositoryId);
    const indexingError =
      'Indexing queue is currently unavailable. Please retry in a moment.';

    return this.repositoriesRepository.updateStatus(
      workspaceId,
      repositoryId,
      previousSuccess
        ? {
            status: RepositoryStatus.READY,
            indexingError,
          }
        : {
            status: RepositoryStatus.FAILED,
            indexingError,
            lastIndexedAt: null,
          },
    );
  }

  private restoreAfterIndexingLimit(
    params: {
      workspaceId: string;
      repositoryId: string;
      previousStatus?: RepositoryStatus;
    },
    message: string,
  ): Promise<Repository | null> {
    const status = params.previousStatus ?? RepositoryStatus.FAILED;
    return this.repositoriesRepository.updateStatus(
      params.workspaceId,
      params.repositoryId,
      {
        status,
        indexingError: status === RepositoryStatus.READY ? null : message,
      },
    );
  }

  private async assertIndexingResourceLimits(params: {
    workspaceId: string;
    userId: string;
    owner: string;
    name: string;
    branch: string;
  }): Promise<void> {
    try {
      await this.githubIndexingEstimateService.assertWithinLimits(params);
    } catch (error) {
      if (isIndexingResourceLimitError(error)) {
        throw new IndexingResourceLimitExceededException(error);
      }
      throw error;
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

  private async assertNotIndexingInProgress(
    repository: Repository,
  ): Promise<void> {
    if (
      repository.status === RepositoryStatus.CLONING ||
      repository.status === RepositoryStatus.PARSING ||
      repository.status === RepositoryStatus.CHUNKING ||
      repository.status === RepositoryStatus.EMBEDDING
    ) {
      throw new ConflictException(
        'Repository indexing is already in progress for this repository',
      );
    }

    const runningRun = await this.repositoriesRepository.hasRunningIndexingRun(
      repository.id,
    );
    if (runningRun) {
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

  private toFileResponse(file: RepositoryFile): RepositoryFileResponseDto {
    return {
      id: file.id,
      repositoryId: file.repositoryId,
      path: file.path,
      language: file.language,
      size: file.size,
      lineCount: file.lineCount,
      extension: file.extension,
      generated: file.generated,
      ignored: file.ignored,
      binary: file.binary,
      createdAt: file.createdAt.toISOString(),
    };
  }

  private toSymbolResponse(symbol: CodeSymbol): CodeSymbolResponseDto {
    return {
      id: symbol.id,
      repositoryId: symbol.repositoryId,
      name: symbol.name,
      qualifiedName: symbol.qualifiedName,
      type: symbol.type,
      filePath: symbol.filePath,
      language: symbol.language,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      fileId: symbol.fileId,
      createdAt: symbol.createdAt.toISOString(),
    };
  }
}
