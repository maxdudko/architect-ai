import { ConfigService } from '@nestjs/config';
import { RepositoryProvider } from '@prisma/client';
import * as childProcess from 'node:child_process';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { GithubHttpService } from '../../integrations/github/github-http.service';
import { RepositoriesRepository } from '../repositories.repository';
import { IndexingStorageService } from './indexing-storage.service';
import { RepositoryCloneService } from './repository-clone.service';

jest.mock('node:child_process', () => {
  const actual = jest.requireActual('node:child_process');
  const execFile = jest.fn();
  return {
    ...actual,
    execFile,
    __mockExecFile: execFile,
  };
});

jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  chmod: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('RepositoryCloneService', () => {
  const repository = {
    id: 'repo-1',
    workspaceId: 'workspace-1',
    provider: RepositoryProvider.GITHUB,
    externalId: '12345',
    owner: 'acme',
    name: 'platform-api',
    fullName: 'acme/platform-api',
    defaultBranch: 'main',
    status: 'PENDING',
    lastIndexedAt: null,
    indexingError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  } as const;

  let configService: jest.Mocked<ConfigService>;
  let repositoriesRepository: jest.Mocked<RepositoriesRepository>;
  let githubAccessTokenService: jest.Mocked<GithubAccessTokenService>;
  let githubHttpService: jest.Mocked<GithubHttpService>;
  let storageService: jest.Mocked<IndexingStorageService>;
  let mockExecFile: jest.Mock;
  let service: RepositoryCloneService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecFile = (childProcess as unknown as { __mockExecFile: jest.Mock })
      .__mockExecFile;

    configService = {
      get: jest.fn((key: string) =>
        key === 'INDEXING_CLONE_TIMEOUT_MS' ? '65000' : undefined,
      ),
    } as unknown as jest.Mocked<ConfigService>;

    repositoriesRepository = {
      findById: jest.fn().mockResolvedValue(repository),
    } as unknown as jest.Mocked<RepositoriesRepository>;

    githubAccessTokenService = {
      executeWithAccessToken: jest.fn(),
    } as unknown as jest.Mocked<GithubAccessTokenService>;

    githubHttpService = {
      getRepositoryById: jest.fn().mockResolvedValue({
        id: 12345,
        full_name: 'acme/platform-api',
      }),
    } as unknown as jest.Mocked<GithubHttpService>;

    storageService = {
      enforceStorageLimit: jest.fn().mockResolvedValue(undefined),
      prepareRunDirectory: jest.fn().mockResolvedValue('/tmp/indexing/run-1'),
    } as unknown as jest.Mocked<IndexingStorageService>;

    githubAccessTokenService.executeWithAccessToken.mockImplementation(
      async (_userId, operation) => operation('gh-token'),
    );

    service = new RepositoryCloneService(
      configService,
      repositoriesRepository,
      githubAccessTokenService,
      githubHttpService,
      storageService,
    );
  });

  it('clones using branch override without embedding token in URL', async () => {
    mockExecFile
      .mockImplementationOnce((_file, _args, options, callback) => {
        callback?.(null, '', '');
      })
      .mockImplementationOnce((_file, _args, options, callback) => {
        callback?.(null, 'abc123\n', '');
      });

    const result = await service.cloneRepository({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      runId: 'run-1',
      userId: 'user-1',
      branch: 'develop',
      trigger: 'MANUAL_REINDEX',
    });

    expect(mockExecFile).toHaveBeenNthCalledWith(
      1,
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        'develop',
        'https://github.com/acme/platform-api.git',
        '/tmp/indexing/run-1/repo',
      ],
      expect.objectContaining({
        timeout: 65000,
        env: expect.objectContaining({
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: '/tmp/indexing/run-1/.git-askpass.sh',
        }),
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      clonePath: '/tmp/indexing/run-1/repo',
      branch: 'develop',
      commitSha: 'abc123',
    });
  });

  it('maps clone timeout to a clear error message', async () => {
    const timeoutError = Object.assign(new Error('timed out'), {
      code: 'ETIMEDOUT',
    });
    mockExecFile.mockImplementationOnce((_file, _args, options, callback) => {
      callback?.(timeoutError, '', '');
    });

    await expect(
      service.cloneRepository({
        workspaceId: 'workspace-1',
        repositoryId: 'repo-1',
        runId: 'run-1',
        userId: 'user-1',
        trigger: 'MANUAL_RETRY',
      }),
    ).rejects.toThrow(
      'Repository clone timed out after 65000ms. Retry with a smaller repository or increase INDEXING_CLONE_TIMEOUT_MS.',
    );
  });

  it('maps missing git executable to runtime setup error', async () => {
    mockExecFile.mockImplementationOnce((_file, _args, options, callback) => {
      callback?.(
        new Error("ENOENT: no such file or directory, spawn 'git'"),
        '',
        '',
      );
    });

    await expect(
      service.cloneRepository({
        workspaceId: 'workspace-1',
        repositoryId: 'repo-1',
        runId: 'run-1',
        userId: 'user-1',
        trigger: 'MANUAL_RETRY',
      }),
    ).rejects.toThrow(
      'Git is not available in the indexing worker runtime. Install git in the worker container.',
    );
  });
});
