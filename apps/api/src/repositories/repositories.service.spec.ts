import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CodeSymbolType,
  RepositoryProvider,
  RepositoryStatus,
} from '@prisma/client';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
import { RepositoryEmbeddingService } from './indexing/repository-embedding.service';
import { RepositoryAccessValidationService } from './repository-access-validation.service';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoriesService } from './repositories.service';
import { RepositoriesRepository } from './repositories.repository';

describe('RepositoriesService', () => {
  const workspaceA = 'workspace-a';
  const workspaceB = 'workspace-b';
  const repositoryId = 'repo-1';

  const repository = {
    id: repositoryId,
    workspaceId: workspaceA,
    provider: RepositoryProvider.GITHUB,
    externalId: '123',
    owner: 'acme',
    name: 'platform-api',
    fullName: 'acme/platform-api',
    defaultBranch: 'main',
    status: RepositoryStatus.PENDING,
    lastIndexedAt: null,
    indexingError: null,
    connectedByUserId: null,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  let repositoriesRepository: jest.Mocked<RepositoriesRepository>;
  let repositoryIndexingQueueService: jest.Mocked<RepositoryIndexingQueueService>;
  let githubAccessTokenService: jest.Mocked<GithubAccessTokenService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;
  let embeddingService: jest.Mocked<RepositoryEmbeddingService>;
  let repositoryAccessValidationService: jest.Mocked<RepositoryAccessValidationService>;
  let service: RepositoriesService;

  beforeEach(() => {
    repositoriesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByProviderAndExternalId: jest.fn(),
      findAnyByProviderAndExternalId: jest.fn(),
      listByWorkspace: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      listExternalIdsByProvider: jest.fn(),
      updateStatus: jest.fn(),
      listCurrentRepositoryFiles: jest.fn(),
      listCurrentCodeSymbols: jest.fn(),
    } as unknown as jest.Mocked<RepositoriesRepository>;

    repositoryIndexingQueueService = {
      enqueueInitialIndexing: jest.fn(),
      enqueueRetryIndexing: jest.fn(),
      enqueueManualReindex: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<RepositoryIndexingQueueService>;

    githubAccessTokenService = {
      executeWithAccessToken: jest.fn(),
    } as unknown as jest.Mocked<GithubAccessTokenService>;

    githubHttpService = {
      buildConnectUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      exchangeRefreshToken: jest.fn(),
      getViewer: jest.fn(),
      listRepositories: jest.fn(),
      getRepositoryById: jest.fn(),
      listBranches: jest.fn(),
    } as unknown as jest.Mocked<GithubHttpService>;

    embeddingService = {
      deleteRepositoryVectors: jest.fn(),
      embedRepository: jest.fn(),
    } as unknown as jest.Mocked<RepositoryEmbeddingService>;
    repositoryAccessValidationService = {
      assertUserCanAccessRepository: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RepositoryAccessValidationService>;

    const analyticsService = {
      recordEvent: jest.fn().mockResolvedValue(null),
      recordSourceCitations: jest.fn().mockResolvedValue([]),
    };

    service = new RepositoriesService(
      repositoriesRepository,
      repositoryIndexingQueueService,
      githubAccessTokenService,
      githubHttpService,
      embeddingService,
      repositoryAccessValidationService,
      analyticsService as never,
    );
  });

  it('lists repositories scoped to a workspace', async () => {
    repositoriesRepository.listByWorkspace.mockResolvedValue([repository]);

    const result = await service.listRepositories(workspaceA);

    expect(repositoriesRepository.listByWorkspace).toHaveBeenCalledWith(
      workspaceA,
    );
    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe(workspaceA);
  });

  it('returns not found when repository is outside the workspace', async () => {
    repositoriesRepository.findById.mockResolvedValue(null);

    await expect(
      service.getRepository(workspaceB, repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositoriesRepository.findById).toHaveBeenCalledWith(
      workspaceB,
      repositoryId,
    );
  });

  it('prevents connecting the same external repository to another workspace', async () => {
    repositoriesRepository.findByProviderAndExternalId.mockResolvedValue(
      repository,
    );

    await expect(
      service.createRepository(workspaceB, 'user-1', {
        provider: RepositoryProvider.GITLAB,
        externalId: '123',
        owner: 'acme',
        name: 'platform-api',
        fullName: 'acme/platform-api',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('queues indexing after connecting a repository', async () => {
    repositoriesRepository.findByProviderAndExternalId.mockResolvedValue(null);
    repositoriesRepository.findAnyByProviderAndExternalId.mockResolvedValue(
      null,
    );
    repositoriesRepository.create.mockResolvedValue(repository);
    githubHttpService.getRepositoryById.mockResolvedValue({
      id: 123,
      name: 'platform-api',
      full_name: 'acme/platform-api',
      private: true,
      default_branch: 'main',
      owner: {
        login: 'acme',
      },
    });
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('plain-token'),
    );

    await service.createRepository(workspaceA, 'user-1', {
      provider: RepositoryProvider.GITHUB,
      externalId: '123',
      owner: 'acme',
      name: 'platform-api',
      fullName: 'acme/platform-api',
    });

    expect(repositoriesRepository.create).toHaveBeenCalledWith(
      workspaceA,
      expect.objectContaining({
        connectedByUserId: 'user-1',
      }),
    );
    expect(
      repositoryIndexingQueueService.enqueueInitialIndexing,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceA,
        repositoryId: repository.id,
        userId: 'user-1',
      }),
    );
  });

  it('honors dto.defaultBranch when connecting a github repository', async () => {
    repositoriesRepository.findByProviderAndExternalId.mockResolvedValue(null);
    repositoriesRepository.findAnyByProviderAndExternalId.mockResolvedValue(
      null,
    );
    repositoriesRepository.create.mockResolvedValue({
      ...repository,
      defaultBranch: 'develop',
    });
    githubHttpService.getRepositoryById.mockResolvedValue({
      id: 123,
      name: 'platform-api',
      full_name: 'acme/platform-api',
      private: true,
      default_branch: 'main',
      owner: {
        login: 'acme',
      },
    });
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('plain-token'),
    );

    await service.createRepository(workspaceA, 'user-1', {
      provider: RepositoryProvider.GITHUB,
      externalId: '123',
      owner: 'acme',
      name: 'platform-api',
      fullName: 'acme/platform-api',
      defaultBranch: 'develop',
      indexBranch: 'develop',
    });

    expect(repositoriesRepository.create).toHaveBeenCalledWith(
      workspaceA,
      expect.objectContaining({
        defaultBranch: 'develop',
      }),
    );
    expect(
      repositoryIndexingQueueService.enqueueInitialIndexing,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'develop',
      }),
    );
  });

  it('marks repository as failed when initial enqueue fails', async () => {
    repositoriesRepository.findByProviderAndExternalId.mockResolvedValue(null);
    repositoriesRepository.findAnyByProviderAndExternalId.mockResolvedValue(
      null,
    );
    repositoriesRepository.create.mockResolvedValue(repository);
    repositoriesRepository.updateStatus.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.FAILED,
      indexingError:
        'Indexing queue is currently unavailable. Please retry in a moment.',
    });
    githubHttpService.getRepositoryById.mockResolvedValue({
      id: 123,
      name: 'platform-api',
      full_name: 'acme/platform-api',
      private: true,
      default_branch: 'main',
      owner: {
        login: 'acme',
      },
    });
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('plain-token'),
    );
    repositoryIndexingQueueService.enqueueInitialIndexing.mockRejectedValue(
      new Error('Repository indexing queue is unavailable'),
    );

    const response = await service.createRepository(workspaceA, 'user-1', {
      provider: RepositoryProvider.GITHUB,
      externalId: '123',
      owner: 'acme',
      name: 'platform-api',
      fullName: 'acme/platform-api',
    });

    expect(repositoriesRepository.updateStatus).toHaveBeenCalledWith(
      workspaceA,
      repository.id,
      expect.objectContaining({
        status: RepositoryStatus.FAILED,
      }),
    );
    expect(response.status).toBe(RepositoryStatus.FAILED);
  });

  it('restores a previously disconnected repository in the same workspace', async () => {
    const deletedRepository = {
      ...repository,
      deletedAt: new Date('2026-06-25T00:00:00.000Z'),
      status: RepositoryStatus.FAILED,
    };

    repositoriesRepository.findByProviderAndExternalId.mockResolvedValue(null);
    repositoriesRepository.findAnyByProviderAndExternalId.mockResolvedValue(
      deletedRepository,
    );
    repositoriesRepository.restore.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.PENDING,
      deletedAt: null,
    });
    githubHttpService.getRepositoryById.mockResolvedValue({
      id: 123,
      name: 'platform-api',
      full_name: 'acme/platform-api',
      private: true,
      default_branch: 'main',
      owner: {
        login: 'acme',
      },
    });
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('plain-token'),
    );

    const result = await service.createRepository(workspaceA, 'user-1', {
      provider: RepositoryProvider.GITHUB,
      externalId: '123',
      owner: 'acme',
      name: 'platform-api',
      fullName: 'acme/platform-api',
    });

    expect(repositoriesRepository.create).not.toHaveBeenCalled();
    expect(repositoriesRepository.restore).toHaveBeenCalledWith(
      workspaceA,
      repository.id,
      expect.objectContaining({
        status: RepositoryStatus.PENDING,
        indexingError: null,
        connectedByUserId: 'user-1',
      }),
    );
    expect(result.id).toBe(repository.id);
  });

  it('soft deletes only within the requested workspace', async () => {
    repositoriesRepository.findById.mockResolvedValue(repository);
    repositoriesRepository.softDelete.mockResolvedValue(1);
    embeddingService.deleteRepositoryVectors.mockResolvedValue();

    const result = await service.deleteRepository(
      workspaceA,
      repositoryId,
      'user-1',
    );

    expect(result).toEqual({ success: true });
    expect(repositoriesRepository.softDelete).toHaveBeenCalledWith(
      workspaceA,
      repositoryId,
    );
    expect(embeddingService.deleteRepositoryVectors).toHaveBeenCalledWith(
      repositoryId,
    );
  });

  it('queues retry indexing with optional branch', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.FAILED,
    });
    repositoriesRepository.updateStatus.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.PENDING,
    });

    await service.retryIndexing(workspaceA, repositoryId, 'user-1', {
      branch: 'develop',
    });

    expect(
      repositoryIndexingQueueService.enqueueRetryIndexing,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceA,
        repositoryId,
        userId: 'user-1',
        branch: 'develop',
      }),
    );
  });

  it('marks retry as failed when queue enqueue fails', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.FAILED,
    });
    repositoriesRepository.updateStatus
      .mockResolvedValueOnce({
        ...repository,
        status: RepositoryStatus.PENDING,
      })
      .mockResolvedValueOnce({
        ...repository,
        status: RepositoryStatus.FAILED,
        indexingError:
          'Indexing queue is currently unavailable. Please retry in a moment.',
      });
    repositoryIndexingQueueService.enqueueRetryIndexing.mockRejectedValue(
      new Error('Repository indexing queue is unavailable'),
    );

    const response = await service.retryIndexing(
      workspaceA,
      repositoryId,
      'user-1',
      {
        branch: 'develop',
      },
    );

    expect(repositoriesRepository.updateStatus).toHaveBeenNthCalledWith(
      2,
      workspaceA,
      repository.id,
      expect.objectContaining({
        status: RepositoryStatus.FAILED,
      }),
    );
    expect(response.status).toBe(RepositoryStatus.FAILED);
  });

  it('rejects retry indexing when repository is not failed', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.READY,
    });

    await expect(
      service.retryIndexing(workspaceA, repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositoriesRepository.updateStatus).not.toHaveBeenCalled();
    expect(
      repositoryIndexingQueueService.enqueueRetryIndexing,
    ).not.toHaveBeenCalled();
  });

  it('queues manual reindex with optional branch', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.READY,
    });
    repositoriesRepository.updateStatus.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.PENDING,
    });

    await service.reindexRepository(workspaceA, repositoryId, 'user-1', {
      branch: 'release/2026.07',
    });

    expect(
      repositoryIndexingQueueService.enqueueManualReindex,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceA,
        repositoryId,
        userId: 'user-1',
        branch: 'release/2026.07',
      }),
    );
  });

  it('rejects reindex when repository is not ready', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.FAILED,
    });

    await expect(
      service.reindexRepository(workspaceA, repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositoriesRepository.updateStatus).not.toHaveBeenCalled();
    expect(
      repositoryIndexingQueueService.enqueueManualReindex,
    ).not.toHaveBeenCalled();
  });

  it('rejects reindex while indexing is active', async () => {
    repositoriesRepository.findById.mockResolvedValue({
      ...repository,
      status: RepositoryStatus.PARSING,
    });

    await expect(
      service.reindexRepository(workspaceA, repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists repository files for a workspace-scoped repository', async () => {
    repositoriesRepository.findById.mockResolvedValue(repository);
    repositoriesRepository.listCurrentRepositoryFiles.mockResolvedValue([
      {
        id: 'file-1',
        repositoryId,
        indexingRunId: 'run-1',
        path: 'src/auth.ts',
        language: 'typescript',
        contentHash: 'abc',
        size: 120,
        lineCount: 10,
        extension: '.ts',
        generated: false,
        ignored: false,
        binary: false,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);

    const files = await service.listRepositoryFiles(
      workspaceA,
      repositoryId,
      'user-1',
      'src/',
    );

    expect(
      repositoriesRepository.listCurrentRepositoryFiles,
    ).toHaveBeenCalledWith(repositoryId, { pathPrefix: 'src/' });
    expect(files).toEqual([
      expect.objectContaining({
        id: 'file-1',
        path: 'src/auth.ts',
        language: 'typescript',
        lineCount: 10,
      }),
    ]);
  });

  it('lists repository symbols with optional filters', async () => {
    repositoriesRepository.findById.mockResolvedValue(repository);
    repositoriesRepository.listCurrentCodeSymbols.mockResolvedValue([
      {
        id: 'symbol-1',
        repositoryId,
        indexingRunId: 'run-1',
        fileId: 'file-1',
        filePath: 'src/auth.ts',
        type: CodeSymbolType.FUNCTION,
        name: 'login',
        qualifiedName: 'src/auth.ts.login',
        language: 'typescript',
        startLine: 4,
        endLine: 8,
        startColumn: 1,
        endColumn: 2,
        exported: true,
        isAsync: true,
        isStatic: false,
        visibility: 'default',
        parentSymbolId: null,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);

    const symbols = await service.listRepositorySymbols(
      workspaceA,
      repositoryId,
      'user-1',
      { filePath: 'src/auth.ts', type: CodeSymbolType.FUNCTION },
    );

    expect(repositoriesRepository.listCurrentCodeSymbols).toHaveBeenCalledWith(
      repositoryId,
      { filePath: 'src/auth.ts', type: CodeSymbolType.FUNCTION },
    );
    expect(symbols).toEqual([
      expect.objectContaining({
        id: 'symbol-1',
        name: 'login',
        type: CodeSymbolType.FUNCTION,
        startLine: 4,
        endLine: 8,
      }),
    ]);
  });

  it('rejects file listing when repository is outside workspace', async () => {
    repositoriesRepository.findById.mockResolvedValue(null);

    await expect(
      service.listRepositoryFiles(workspaceB, repositoryId, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
