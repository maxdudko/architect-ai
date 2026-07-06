import { Injectable } from '@nestjs/common';
import { RepositoryProvider } from '@prisma/client';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { GithubHttpService } from '../../integrations/github/github-http.service';
import { RepositoriesRepository } from '../repositories.repository';
import { CloneJobData } from './indexing-job.types';
import { IndexingStorageService } from './indexing-storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class RepositoryCloneService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
    private readonly storageService: IndexingStorageService,
  ) {}

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

    const cloneUrl = await this.githubAccessTokenService.executeWithAccessToken(
      data.userId,
      async (token) => {
        const details = await this.githubHttpService.getRepositoryById(
          token,
          repository.externalId,
        );
        return `https://x-access-token:${token}@github.com/${details.full_name}.git`;
      },
    );

    try {
      await execFileAsync('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        branch,
        cloneUrl,
        clonePath,
      ]);
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
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
      throw error;
    }
  }
}
