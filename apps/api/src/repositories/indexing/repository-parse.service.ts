import { Injectable } from '@nestjs/common';
import { IndexingResourceMetric } from '@prisma/client';
import { isIndexableFilesLimitExceededError } from '../../modules/code-intelligence/errors/indexable-files-limit-exceeded.error';
import { CodeIntelligenceParseService } from '../../modules/code-intelligence/extractors/code-intelligence-parse.service';
import { IndexingResourceLimitService } from '../../usage/indexing-resource-limit.service';

@Injectable()
export class RepositoryParseService {
  constructor(
    private readonly codeIntelligenceParseService: CodeIntelligenceParseService,
    private readonly indexingResourceLimitService: IndexingResourceLimitService,
  ) {}

  async parseRepository(data: {
    workspaceId: string;
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{
    supportedFileCount: number;
    ignoredFileCount: number;
    symbolCount: number;
  }> {
    const limits =
      await this.indexingResourceLimitService.getLimitsForWorkspace(
        data.workspaceId,
      );

    try {
      return await this.codeIntelligenceParseService.parseRepository({
        repositoryId: data.repositoryId,
        indexingRunId: data.runId,
        clonePath: data.clonePath,
        maxFileSizeBytes: limits.FILE_SIZE_BYTES,
        maxIndexableFiles: limits.INDEXABLE_FILES,
      });
    } catch (error) {
      if (isIndexableFilesLimitExceededError(error)) {
        throw this.indexingResourceLimitService.createExceededError(
          IndexingResourceMetric.INDEXABLE_FILES,
          error.used,
          error.limit,
        );
      }
      throw error;
    }
  }
}
