import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryProvider } from '@prisma/client';
import { execFile } from 'node:child_process';
import { chmod, rm, writeFile } from 'node:fs/promises';
import path from 'path';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { GithubHttpService } from '../../integrations/github/github-http.service';
import { RepositoriesRepository } from '../repositories.repository';
import { CloneJobData } from './indexing-job.types';
import { IndexingStorageService } from './indexing-storage.service';

@Injectable()
export class RepositoryCloneService {
  private readonly cloneTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
    private readonly storageService: IndexingStorageService,
  ) {
    this.cloneTimeoutMs = Number(
      this.configService.get<string>('INDEXING_CLONE_TIMEOUT_MS') ?? 120_000,
    );
  }

  async cloneRepository(data: CloneJobData): Promise<{
    clonePath: string;
    branch: string;
    commitSha: string;
  }> {
    await this.storageService.enforceStorageLimit();
    const runDirectory = await this.storageService.prepareRunDirectory(
      data.runId,
    );
    const repository = await this.repositoriesRepository.findById(
      data.workspaceId,
      data.repositoryId,
    );
    if (!repository) {
      throw new Error('Repository not found');
    }

    const branch = data.branch || repository.defaultBranch;
    const clonePath = path.join(runDirectory, 'repo');

    if (repository.provider !== RepositoryProvider.GITHUB) {
      throw new Error('Only GitHub repositories are currently supported');
    }

    const { cloneUrl, accessToken } =
      await this.githubAccessTokenService.executeWithAccessToken(
        data.userId,
        async (token) => {
          const details = await this.githubHttpService.getRepositoryById(
            token,
            repository.externalId,
          );
          return {
            cloneUrl: `https://github.com/${details.full_name}.git`,
            accessToken: token,
          };
        },
      );
    const askPassPath = path.join(runDirectory, '.git-askpass.sh');
    await this.writeAskPassScript(askPassPath, accessToken);

    try {
      await this.execFileAsync(
        'git',
        ['clone', '--depth', '1', '--branch', branch, cloneUrl, clonePath],
        {
          timeout: this.cloneTimeoutMs,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: askPassPath,
          },
        },
      );
      const { stdout } = await this.execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: clonePath,
      });

      return {
        clonePath,
        branch,
        commitSha: stdout.trim(),
      };
    } catch (error) {
      const isMissingGit =
        error instanceof Error &&
        (error.message.includes('spawn git ENOENT') ||
          error.message.includes("ENOENT: no such file or directory, spawn 'git'"));
      if (isMissingGit) {
        throw new Error(
          'Git is not available in the indexing worker runtime. Install git in the worker container.',
        );
      }
      const isCloneTimeout =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ETIMEDOUT';
      if (isCloneTimeout) {
        throw new Error(
          `Repository clone timed out after ${this.cloneTimeoutMs}ms. Retry with a smaller repository or increase INDEXING_CLONE_TIMEOUT_MS.`,
        );
      }
      throw error;
    } finally {
      await rm(askPassPath, { force: true });
    }
  }

  private async writeAskPassScript(
    askPassPath: string,
    accessToken: string,
  ): Promise<void> {
    const escapedToken = accessToken.replace(/'/g, `'\\''`);
    const script = `#!/usr/bin/env sh
prompt="$1"
case "$prompt" in
  *Username* ) echo "x-access-token" ;;
  *Password* ) echo '${escapedToken}' ;;
  * ) echo '${escapedToken}' ;;
esac
`;
    await writeFile(askPassPath, script, { mode: 0o700 });
    await chmod(askPassPath, 0o700);
  }

  private execFileAsync(
    command: string,
    args: string[],
    options?: {
      cwd?: string;
      timeout?: number;
      env?: NodeJS.ProcessEnv;
    },
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(command, args, options ?? {}, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      });
    });
  }
}
