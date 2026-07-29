import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { RepositoryProvider } from '@prisma/client';
import * as childProcess from 'node:child_process';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { MembershipsRepository } from '../../memberships/memberships.repository';
import { RepositoriesRepository } from '../repositories.repository';
import { IndexingStorageService } from './indexing-storage.service';
import { RepositoryCloneService } from './repository-clone.service';

jest.mock('node:child_process', () => {
  const actual =
    jest.requireActual<typeof import('node:child_process')>(
      'node:child_process',
    );
  return {
    ...actual,
    execFile: jest.fn(),
  };
});

jest.mock('node:fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    writeFile: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
  };
});

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

function invokeExecCallback(
  callback: ExecFileCallback | undefined,
  error: Error | null,
  stdout = '',
  stderr = '',
): childProcess.ChildProcess {
  if (callback) {
    callback(error, stdout, stderr);
  }
  return {} as childProcess.ChildProcess;
}

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
  let membershipsRepository: jest.Mocked<MembershipsRepository>;
  let storageService: jest.Mocked<IndexingStorageService>;
  let mockExecFile: jest.MockedFunction<typeof childProcess.execFile>;
  let service: RepositoryCloneService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecFile = childProcess.execFile as jest.MockedFunction<
      typeof childProcess.execFile
    >;

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

    membershipsRepository = {
      listActiveUserIdsByWorkspace: jest
        .fn()
        .mockResolvedValue(['user-1', 'user-2']),
    } as unknown as jest.Mocked<MembershipsRepository>;

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
      membershipsRepository,
      storageService,
    );
  });

  it('clones using branch override without embedding token in URL', async () => {
    mockExecFile
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, '', ''),
      )
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, 'abc123\n', ''),
      );

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
          GIT_ASKPASS: '/tmp/indexing/run-1/.git-askpass-user-1.sh',
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
    mockExecFile.mockImplementationOnce(
      (_file, _args, _options, callback?: ExecFileCallback) =>
        invokeExecCallback(callback, timeoutError, '', ''),
    );

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
    mockExecFile.mockImplementationOnce(
      (_file, _args, _options, callback?: ExecFileCallback) =>
        invokeExecCallback(
          callback,
          new Error("ENOENT: no such file or directory, spawn 'git'"),
          '',
          '',
        ),
    );

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

  it('falls back to another workspace member token when first is unavailable', async () => {
    githubAccessTokenService.executeWithAccessToken
      .mockRejectedValueOnce(
        new NotFoundException('GitHub account is not connected'),
      )
      .mockImplementationOnce(async (_userId, operation) =>
        operation('gh-token-2'),
      );
    mockExecFile
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, '', ''),
      )
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, 'def456\n', ''),
      );

    const result = await service.cloneRepository({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      runId: 'run-1',
      userId: 'user-1',
      trigger: 'MANUAL_RETRY',
    });

    expect(
      githubAccessTokenService.executeWithAccessToken,
    ).toHaveBeenNthCalledWith(1, 'user-1', expect.any(Function));
    expect(
      githubAccessTokenService.executeWithAccessToken,
    ).toHaveBeenNthCalledWith(2, 'user-2', expect.any(Function));
    expect(result.commitSha).toBe('def456');
  });

  it('falls back to anonymous clone when member tokens cannot access the repo', async () => {
    githubAccessTokenService.executeWithAccessToken.mockRejectedValue(
      new NotFoundException('GitHub account is not connected'),
    );
    mockExecFile
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, '', ''),
      )
      .mockImplementationOnce(
        (_file, _args, _options, callback?: ExecFileCallback) =>
          invokeExecCallback(callback, null, 'pub789\n', ''),
      );

    const result = await service.cloneRepository({
      workspaceId: 'workspace-1',
      repositoryId: 'repo-1',
      runId: 'run-1',
      userId: 'user-1',
      trigger: 'MANUAL_RETRY',
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        'main',
        'https://github.com/acme/platform-api.git',
        '/tmp/indexing/run-1/repo',
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          GIT_TERMINAL_PROMPT: '0',
        }),
      }),
      expect.any(Function),
    );
    const anonymousCall = mockExecFile.mock.calls.find(
      (call) =>
        Array.isArray(call[1]) &&
        call[1][0] === 'clone' &&
        !(call[2] as { env?: { GIT_ASKPASS?: string } })?.env?.GIT_ASKPASS,
    );
    expect(anonymousCall).toBeDefined();
    expect(result.commitSha).toBe('pub789');
  });
});
