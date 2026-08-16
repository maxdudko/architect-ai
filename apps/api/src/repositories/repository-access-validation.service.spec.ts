import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryProvider } from '@prisma/client';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoryAccessValidationService } from './repository-access-validation.service';

describe('RepositoryAccessValidationService', () => {
  const workspaceId = 'workspace-1';
  const repositoryId = 'repo-1';
  const userId = 'user-1';
  const repository = {
    id: repositoryId,
    workspaceId,
    provider: RepositoryProvider.GITHUB,
    externalId: '123',
  };

  let configService: jest.Mocked<ConfigService>;
  let repositoriesRepository: jest.Mocked<RepositoriesRepository>;
  let githubAccessTokenService: jest.Mocked<GithubAccessTokenService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;
  let service: RepositoryAccessValidationService;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('true'),
    } as unknown as jest.Mocked<ConfigService>;
    repositoriesRepository = {
      findById: jest.fn().mockResolvedValue(repository),
    } as unknown as jest.Mocked<RepositoriesRepository>;
    githubAccessTokenService = {
      executeWithAccessToken: jest.fn(),
    } as unknown as jest.Mocked<GithubAccessTokenService>;
    githubHttpService = {
      getRepositoryById: jest.fn(),
    } as unknown as jest.Mocked<GithubHttpService>;

    service = new RepositoryAccessValidationService(
      configService,
      repositoriesRepository,
      githubAccessTokenService,
      githubHttpService,
    );
  });

  it('assertRepositoryInWorkspace only checks workspace membership', async () => {
    await service.assertRepositoryInWorkspace({ workspaceId, repositoryId });

    expect(repositoriesRepository.findById).toHaveBeenCalledWith(
      workspaceId,
      repositoryId,
    );
    expect(
      githubAccessTokenService.executeWithAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('assertRepositoryInWorkspace throws when repository is missing', async () => {
    repositoriesRepository.findById.mockResolvedValue(null);

    await expect(
      service.assertRepositoryInWorkspace({ workspaceId, repositoryId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertUserCanAccessRepository calls GitHub with the user token', async () => {
    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, callback) => callback('token'),
    );
    githubHttpService.getRepositoryById.mockResolvedValue({
      id: 123,
    } as never);

    await service.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });

    expect(githubHttpService.getRepositoryById).toHaveBeenCalledWith(
      'token',
      '123',
    );
  });

  it('assertUserCanAccessRepository forbids when GitHub denies access', async () => {
    githubAccessTokenService.executeWithAccessToken.mockRejectedValue(
      new Error('unauthorized'),
    );

    await expect(
      service.assertUserCanAccessRepository({
        workspaceId,
        repositoryId,
        userId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
