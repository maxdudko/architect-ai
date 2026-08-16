import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepositoryProvider } from '@prisma/client';
import { GithubAccessTokenService } from '../integrations/github/github-access-token.service';
import { GithubHttpService } from '../integrations/github/github-http.service';
import { RepositoriesRepository } from './repositories.repository';

interface AccessValidationCacheEntry {
  expiresAt: number;
}

@Injectable()
export class RepositoryAccessValidationService {
  private readonly cache = new Map<string, AccessValidationCacheEntry>();
  private readonly cacheTtlMs = 30_000;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
  ) {
    this.enabled =
      (this.configService.get<string>('REPOSITORY_ACCESS_VALIDATION_ENABLED') ??
        'true') === 'true';
  }

  async assertRepositoryInWorkspace(params: {
    workspaceId: string;
    repositoryId: string;
  }): Promise<void> {
    const repository = await this.repositoriesRepository.findById(
      params.workspaceId,
      params.repositoryId,
    );
    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }
  }

  /**
   * Live GitHub ACL check for the caller's OAuth token.
   * Use for clone / reindex / generate / repo mutations — not for reading
   * workspace-indexed content (guides, files, chat), which is gated by
   * workspace membership alone.
   */
  async assertUserCanAccessRepository(params: {
    workspaceId: string;
    repositoryId: string;
    userId: string;
  }): Promise<void> {
    const repository = await this.repositoriesRepository.findById(
      params.workspaceId,
      params.repositoryId,
    );
    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }

    if (!this.enabled) {
      return;
    }

    if (repository.provider !== RepositoryProvider.GITHUB) {
      return;
    }

    const cacheKey = `${params.userId}:${repository.externalId}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return;
    }

    try {
      await this.githubAccessTokenService.executeWithAccessToken(
        params.userId,
        (accessToken) =>
          this.githubHttpService.getRepositoryById(
            accessToken,
            repository.externalId,
          ),
      );
      this.cache.set(cacheKey, { expiresAt: now + this.cacheTtlMs });
    } catch {
      throw new ForbiddenException(
        'Your GitHub account no longer has access to this repository. Reconnect GitHub or request access.',
      );
    }
  }
}
