import { Injectable, Logger } from '@nestjs/common';
import { IndexingResourceMetric } from '@prisma/client';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { GithubHttpService } from '../../integrations/github/github-http.service';
import { LanguagePackRegistry } from '../../modules/code-intelligence/languages/language-pack.registry';
import { classifyIndexableFile } from '../../modules/code-intelligence/scanner/indexable-file.policy';
import { IndexingResourceLimitService } from '../../usage/indexing-resource-limit.service';

export interface GithubIndexingEstimate {
  workingTreeBytes: number;
  indexableFileCount: number;
  truncated: boolean;
}

@Injectable()
export class GithubIndexingEstimateService {
  private readonly logger = new Logger(GithubIndexingEstimateService.name);

  constructor(
    private readonly githubAccessTokenService: GithubAccessTokenService,
    private readonly githubHttpService: GithubHttpService,
    private readonly languagePacks: LanguagePackRegistry,
    private readonly indexingResourceLimitService: IndexingResourceLimitService,
  ) {}

  async assertWithinLimits(params: {
    workspaceId: string;
    userId: string;
    owner: string;
    name: string;
    branch: string;
  }): Promise<void> {
    const limits =
      await this.indexingResourceLimitService.getLimitsForWorkspace(
        params.workspaceId,
      );
    const estimate = await this.tryEstimate({
      ...params,
      maxFileSizeBytes: limits.FILE_SIZE_BYTES,
    });
    if (!estimate) {
      return;
    }

    this.indexingResourceLimitService.assertAgainstLimit(
      IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
      estimate.workingTreeBytes,
      limits.REPOSITORY_SIZE_BYTES,
    );
    this.indexingResourceLimitService.assertAgainstLimit(
      IndexingResourceMetric.INDEXABLE_FILES,
      estimate.indexableFileCount,
      limits.INDEXABLE_FILES,
    );
  }

  async tryEstimate(params: {
    userId: string;
    owner: string;
    name: string;
    branch: string;
    maxFileSizeBytes?: number | null;
  }): Promise<GithubIndexingEstimate | null> {
    try {
      return await this.githubAccessTokenService.executeWithAccessToken(
        params.userId,
        (accessToken) => this.estimateWithToken(accessToken, params),
      );
    } catch (error) {
      this.logger.warn(
        `GitHub tree estimate skipped for ${params.owner}/${params.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async estimateWithToken(
    accessToken: string,
    params: {
      owner: string;
      name: string;
      branch: string;
      maxFileSizeBytes?: number | null;
    },
  ): Promise<GithubIndexingEstimate> {
    const branch = await this.githubHttpService.getBranch(
      accessToken,
      params.owner,
      params.name,
      params.branch,
    );
    const treeSha = branch.commit.commit?.tree?.sha ?? branch.commit.sha;
    const tree = await this.githubHttpService.getRecursiveTree(
      accessToken,
      params.owner,
      params.name,
      treeSha,
    );

    const ignoredFolders = this.languagePacks.ignoredFolders();
    let workingTreeBytes = 0;
    let indexableFileCount = 0;

    for (const entry of tree.tree) {
      if (entry.type !== 'blob' || !entry.path) {
        continue;
      }
      const size = typeof entry.size === 'number' ? entry.size : 0;
      workingTreeBytes += size;

      const classification = classifyIndexableFile({
        relativePath: entry.path,
        size,
        ignoredFolders,
        isManifest: (relativePath) =>
          this.languagePacks.isManifest(relativePath),
        detectLanguage: (filePath) =>
          this.languagePacks.detectLanguage(filePath),
        maxFileSizeBytes: params.maxFileSizeBytes,
      });
      if (classification === 'indexable') {
        indexableFileCount += 1;
      }
    }

    return {
      workingTreeBytes,
      indexableFileCount,
      truncated: Boolean(tree.truncated),
    };
  }
}
