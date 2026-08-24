import { ChunkForIndexing } from '../types/chunk-for-indexing.type';
import { SemanticChunkRecord } from '../types/semantic-chunk-record.type';

export interface ChunkDataSource {
  listChunksForIndexing(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<ChunkForIndexing[]>;

  getChunksByIds(chunkIds: string[]): Promise<SemanticChunkRecord[]>;

  listLiveIndexingRunIds(
    workspaceId: string,
    repositoryIds?: string[],
  ): Promise<string[]>;

  listVectorizedChunksByIndexingRun(): Promise<
    Array<{ indexingRunId: string; chunkIds: string[] }>
  >;
}
