import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryProvider } from '@prisma/client';
import { execFile } from 'node:child_process';
import { chmod, rm, writeFile } from 'node:fs/promises';
import path from 'path';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { MembershipsRepository } from '../../memberships/memberships.repository';
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
    private readonly membershipsRepository: MembershipsRepository,
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

    const cloneUrl = `https://github.com/${repository.fullName}.git`;
    const candidateUserIds = await this.getCandidateUserIds(
      data.workspaceId,
      data.userId,
    );

    let lastError: unknown = null;

    for (const candidateUserId of candidateUserIds) {
      const askPassPath = path.join(runDirectory, `.git-askpass-${candidateUserId}.sh`);
      try {
        await rm(clonePath, { recursive: true, force: true });
        const accessToken =
          await this.githubAccessTokenService.executeWithAccessToken(
            candidateUserId,
            async (token) => token,
          );
        await this.writeAskPassScript(askPassPath, accessToken);
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
        if (this.isMissingGitError(error)) {
          throw new Error(
            'Git is not available in the indexing worker runtime. Install git in the worker container.',
          );
        }
        if (this.isCloneTimeoutError(error)) {
          throw new Error(
            `Repository clone timed out after ${this.cloneTimeoutMs}ms. Retry with a smaller repository or increase INDEXING_CLONE_TIMEOUT_MS.`,
          );
        }
        if (
          error instanceof NotFoundException ||
          error instanceof UnauthorizedException ||
          this.isGitAuthError(error)
        ) {
          lastError = error;
          continue;
        }
        throw error;
      } finally {
        await rm(askPassPath, { force: true });
      }
    }

    if (!candidateUserIds.length) {
      throw new Error(
        'No active workspace members are available to authorize repository cloning.',
      );
    }

    throw (
      lastError ??
      new Error(
        'Repository clone failed because no workspace member has a valid GitHub authorization for this repository.',
      )
    );
  }

  private async getCandidateUserIds(
    workspaceId: string,
    preferredUserId: string,
  ): Promise<string[]> {
    const workspaceUserIds =
      await this.membershipsRepository.listActiveUserIdsByWorkspace(workspaceId);
    const candidates = [preferredUserId, ...workspaceUserIds];
    return [...new Set(candidates)];
  }

  private isMissingGitError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('spawn git ENOENT') ||
        error.message.includes("ENOENT: no such file or directory, spawn 'git'"))
    );
  }

  private isCloneTimeoutError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ETIMEDOUT'
    );
  }

  private isGitAuthError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes('authentication failed') ||
      message.includes('repository not found') ||
      message.includes('could not read username') ||
      message.includes('access denied')
    );
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
