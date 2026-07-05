import { ConflictException, NotFoundException } from '@nestjs/common';
import { RepositoryProvider, RepositoryStatus } from '@prisma/client';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
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
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  let repositoriesRepository: jest.Mocked<RepositoriesRepository>;
  let repositoryIndexingQueueService: jest.Mocked<RepositoryIndexingQueueService>;
  let githubAccessTokenService: jest.Mocked<GithubAccessTokenService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;
  let service: RepositoriesService;

  beforeEach(() => {
    repositoriesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByProviderAndExternalId: jest.fn(),
      listByWorkspace: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      listExternalIdsByProvider: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<RepositoriesRepository>;

    repositoryIndexingQueueService = {
      enqueueIndexing: jest.fn(),
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
    } as unknown as jest.Mocked<GithubHttpService>;

    service = new RepositoriesService(
      repositoriesRepository,
      repositoryIndexingQueueService,
      githubAccessTokenService,
      githubHttpService,
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
      service.getRepository(workspaceB, repositoryId),
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

    expect(repositoryIndexingQueueService.enqueueIndexing).toHaveBeenCalledWith(
      workspaceA,
      repository.id,
    );
  });

  it('soft deletes only within the requested workspace', async () => {
    repositoriesRepository.findById.mockResolvedValue(repository);
    repositoriesRepository.softDelete.mockResolvedValue(1);

    const result = await service.deleteRepository(workspaceA, repositoryId);

    expect(result).toEqual({ success: true });
    expect(repositoriesRepository.softDelete).toHaveBeenCalledWith(
      workspaceA,
      repositoryId,
    );
  });
});
