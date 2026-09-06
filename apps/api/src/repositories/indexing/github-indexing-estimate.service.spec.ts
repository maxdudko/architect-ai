import { IndexingResourceMetric } from '@prisma/client';
import { GithubAccessTokenService } from '../../integrations/github/github-access-token.service';
import { GithubHttpService } from '../../integrations/github/github-http.service';
import { createDefaultLanguagePackRegistry } from '../../modules/code-intelligence/languages/default-language-packs';
import { IndexingResourceLimitError } from '../../usage/indexing-resource-limit.error';
import { IndexingResourceLimitService } from '../../usage/indexing-resource-limit.service';
import { GithubIndexingEstimateService } from './github-indexing-estimate.service';

describe('GithubIndexingEstimateService', () => {
  let githubAccessTokenService: { executeWithAccessToken: jest.Mock };
  let githubHttpService: {
    getBranch: jest.Mock;
    getRecursiveTree: jest.Mock;
  };
  let indexingResourceLimitService: IndexingResourceLimitService;
  let service: GithubIndexingEstimateService;

  beforeEach(() => {
    githubAccessTokenService = {
      executeWithAccessToken: jest.fn(
        async (
          _userId: string,
          operation: (token: string) => Promise<unknown>,
        ) => operation('token'),
      ),
    };
    githubHttpService = {
      getBranch: jest.fn().mockResolvedValue({
        name: 'main',
        commit: { sha: 'abc', commit: { tree: { sha: 'tree-1' } } },
      }),
      getRecursiveTree: jest.fn(),
    };
    indexingResourceLimitService = new IndexingResourceLimitService({
      workspace: {
        findFirst: jest.fn().mockResolvedValue({ planId: 'plan-free' }),
      },
      planIndexingLimit: {
        findMany: jest.fn().mockResolvedValue([
          {
            metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
            maxValue: 262144000n,
          },
          {
            metric: IndexingResourceMetric.INDEXABLE_FILES,
            maxValue: 10_000n,
          },
          {
            metric: IndexingResourceMetric.FILE_SIZE_BYTES,
            maxValue: 1048576n,
          },
        ]),
      },
    } as never);
    service = new GithubIndexingEstimateService(
      githubAccessTokenService as unknown as GithubAccessTokenService,
      githubHttpService as unknown as GithubHttpService,
      createDefaultLanguagePackRegistry(),
      indexingResourceLimitService,
    );
  });

  it('rejects when blob sizes already exceed the repository size cap', async () => {
    githubHttpService.getRecursiveTree.mockResolvedValue({
      sha: 'tree-1',
      truncated: false,
      tree: [
        { path: 'vendor/data.bin', type: 'blob', size: 200 * 1024 * 1024 },
        { path: 'src/app.ts', type: 'blob', size: 80 * 1024 * 1024 },
      ],
    });

    await expect(
      service.assertWithinLimits({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        owner: 'acme',
        name: 'huge-repo',
        branch: 'main',
      }),
    ).rejects.toBeInstanceOf(IndexingResourceLimitError);
  });

  it('counts only indexable files toward the file cap', async () => {
    githubHttpService.getRecursiveTree.mockResolvedValue({
      sha: 'tree-1',
      truncated: false,
      tree: [
        { path: 'src/a.ts', type: 'blob', size: 100 },
        { path: 'src/b.ts', type: 'blob', size: 100 },
        { path: 'logo.png', type: 'blob', size: 100 },
        { path: 'node_modules/pkg/index.js', type: 'blob', size: 100 },
      ],
    });

    await expect(
      service.assertWithinLimits({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        owner: 'acme',
        name: 'app',
        branch: 'main',
      }),
    ).resolves.toBeUndefined();
  });

  it('skips the pre-check when GitHub tree lookup fails', async () => {
    githubHttpService.getBranch.mockRejectedValue(new Error('GitHub down'));

    await expect(
      service.assertWithinLimits({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        owner: 'acme',
        name: 'app',
        branch: 'main',
      }),
    ).resolves.toBeUndefined();
  });
});
