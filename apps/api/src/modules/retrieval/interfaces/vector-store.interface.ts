import { ChunkVectorPayload } from '../types/chunk-vector-payload.type';
import { SearchFilter } from '../types/search-filter.type';
import { VectorPoint } from '../types/vector-point.type';
import { VectorSearchHit } from '../types/vector-search-hit.type';
import { VectorSearchOptions } from '../types/vector-search-options.type';

export interface VectorStore {
  createCollection(dimensions: number): Promise<void>;
  upsert(points: VectorPoint[]): Promise<void>;
  delete(ids: string[]): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  deleteByIndexingRun(indexingRunId: string): Promise<void>;
  setPayload(
    pointIds: string[],
    payload: Record<string, unknown>,
  ): Promise<void>;
  search(
    vector: number[],
    filter: SearchFilter | undefined,
    options: VectorSearchOptions,
  ): Promise<VectorSearchHit[]>;
}

export type { ChunkVectorPayload, SearchFilter, VectorPoint, VectorSearchHit };
