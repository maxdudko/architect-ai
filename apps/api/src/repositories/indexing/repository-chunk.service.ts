import { Injectable } from '@nestjs/common';
import { IndexingResourceMetric } from '@prisma/client';
import { ChunkBuilderService } from '../../modules/code-intelligence/extractors/chunk-builder.service';
import { IndexingResourceLimitService } from '../../usage/indexing-resource-limit.service';

@Injectable()
export class RepositoryChunkService {
  constructor(
    private readonly chunkBuilderService: ChunkBuilderService,
    private readonly indexingResourceLimitService: IndexingResourceLimitService,
  ) {}

  async chunkRepository(data: {
    workspaceId: string;
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{ chunkCount: number; tokenCount: number }> {
    const result = await this.chunkBuilderService.buildChunks({
      repositoryId: data.repositoryId,
      indexingRunId: data.runId,
      clonePath: data.clonePath,
    });

    await this.indexingResourceLimitService.assertWithin(
      data.workspaceId,
      IndexingResourceMetric.EMBEDDING_CHUNKS,
      result.chunkCount,
    );
    await this.indexingResourceLimitService.assertWithin(
      data.workspaceId,
      IndexingResourceMetric.INDEXED_TOKENS,
      result.tokenCount,
    );

    return result;
  }
}
