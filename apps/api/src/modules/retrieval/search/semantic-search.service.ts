import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { RetrievalCache } from '../interfaces/retrieval-cache.interface';
import type { VectorStore } from '../interfaces/vector-store.interface';
import {
  EMBEDDING_PROVIDER,
  RETRIEVAL_CACHE,
  VECTOR_STORE,
} from '../interfaces/tokens';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import type { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';
import {
  buildQueryEmbeddingCacheKey,
  hitToCandidate,
  payloadFieldSelector,
} from '../utils/payload.mapper';
import { SearchFilterBuilder } from './search-filter.builder';

export interface SemanticSearchParams {
  query: string;
  workspaceId: string;
  repositoryIds?: string[];
  language?: string;
  symbolType?: string;
  branch?: string;
  topK?: number;
  scoreThreshold?: number;
}

@Injectable()
export class SemanticSearchService {
  private readonly queryEmbeddingCacheTtlSeconds: number;

  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    @Inject(VECTOR_STORE)
    private readonly vectorStore: VectorStore,
    @Inject(RETRIEVAL_CACHE)
    private readonly cache: RetrievalCache,
    private readonly metrics: RetrievalMetricsService,
    private readonly configService: ConfigService,
  ) {
    this.queryEmbeddingCacheTtlSeconds = Number(
      this.configService.get<string>(
        'RETRIEVAL_QUERY_EMBEDDING_CACHE_TTL_SECONDS',
      ) ?? 3600,
    );
  }

  async search(params: SemanticSearchParams): Promise<ScoredChunkCandidate[]> {
    const topK = params.topK ?? 12;
    const queryVector = await this.getQueryEmbedding(params.query);

    const filterBuilder = new SearchFilterBuilder().workspace(
      params.workspaceId,
    );
    if (params.repositoryIds && params.repositoryIds.length > 0) {
      filterBuilder.repository(params.repositoryIds);
    }
    if (params.language) {
      filterBuilder.language(params.language);
    }
    if (params.symbolType) {
      filterBuilder.symbolType(params.symbolType);
    }
    if (params.branch) {
      filterBuilder.branch(params.branch);
    }

    const vectorStartedAt = Date.now();
    const hits = await this.vectorStore.search(
      queryVector,
      filterBuilder.build(),
      {
        topK,
        withPayload: payloadFieldSelector(),
        scoreThreshold: params.scoreThreshold,
      },
    );
    this.metrics.recordVectorSearch(Date.now() - vectorStartedAt);

    return hits.map(hitToCandidate);
  }

  private async getQueryEmbedding(query: string): Promise<number[]> {
    const cacheKey = buildQueryEmbeddingCacheKey(
      this.embeddingProvider.model,
      query,
    );
    const cached = await this.cache.get<number[]>(cacheKey);
    if (cached) {
      this.metrics.recordCacheHit();
      return cached;
    }

    this.metrics.recordCacheMiss();
    const startedAt = Date.now();
    const embedding = await this.embeddingProvider.embed(query);
    this.metrics.recordEmbedding(Date.now() - startedAt, 1);
    await this.cache.set(
      cacheKey,
      embedding,
      this.queryEmbeddingCacheTtlSeconds,
    );
    return embedding;
  }
}
