import { Injectable } from '@nestjs/common';
import { ChunkBuilderService } from '../../modules/code-intelligence/extractors/chunk-builder.service';

@Injectable()
export class RepositoryChunkService {
  constructor(private readonly chunkBuilderService: ChunkBuilderService) {}

  async chunkRepository(data: {
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{ chunkCount: number }> {
    return this.chunkBuilderService.buildChunks({
      repositoryId: data.repositoryId,
      indexingRunId: data.runId,
      clonePath: data.clonePath,
    });
  }
}
