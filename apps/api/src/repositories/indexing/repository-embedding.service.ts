import { Injectable } from '@nestjs/common';
import { RetrievalIndexingService } from '../../modules/retrieval/indexing/retrieval-indexing.service';
import { RepositoriesRepository } from '../repositories.repository';

@Injectable()
export class RepositoryEmbeddingService {
  constructor(
    private readonly retrievalIndexingService: RetrievalIndexingService,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  async embedRepository(data: {
    workspaceId: string;
    repositoryId: string;
    runId: string;
    branch: string;
    commitSha: string;
  }): Promise<{ embeddedCount: number }> {
    const result = await this.retrievalIndexingService.indexRepositoryChunks({
      workspaceId: data.workspaceId,
      repositoryId: data.repositoryId,
      indexingRunId: data.runId,
      branch: data.branch,
    });

    if (result.embeddedCount === 0) {
      return result;
    }

    const chunks = await this.repositoriesRepository.listChunks(
      data.repositoryId,
      data.runId,
    );

    await this.repositoriesRepository.updateChunkVectorIds(
      data.repositoryId,
      data.runId,
      chunks.map((chunk) => ({
        chunkId: chunk.id,
        vectorId: chunk.id,
      })),
      this.retrievalIndexingService.getEmbeddingModel(),
    );

    return result;
  }

  async deleteRepositoryVectors(repositoryId: string): Promise<void> {
    await this.retrievalIndexingService.deleteRepositoryVectors(repositoryId);
  }
}
