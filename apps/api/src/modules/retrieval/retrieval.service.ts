import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContextAssemblerService } from './context/context-assembler.service';
import type { ChunkDataSource } from './interfaces/chunk-data-source.interface';
import type { RetrievalCache } from './interfaces/retrieval-cache.interface';
import { CHUNK_DATA_SOURCE, RETRIEVAL_CACHE } from './interfaces/tokens';
import { RetrievalMetricsService } from './metrics/retrieval-metrics.service';
import { SearchRankingService } from './ranking/search-ranking.service';
import {
  type SemanticSearchParams,
  SemanticSearchService,
} from './search/semantic-search.service';
import type { RetrievedContext } from './types/retrieved-context.type';
import { buildContextCacheKey } from './utils/payload.mapper';

@Injectable()
export class RetrievalService {
  private readonly contextCacheTtlSeconds: number;

  constructor(
    private readonly semanticSearchService: SemanticSearchService,
    private readonly rankingService: SearchRankingService,
    private readonly contextAssembler: ContextAssemblerService,
    private readonly metrics: RetrievalMetricsService,
    @Inject(RETRIEVAL_CACHE)
    private readonly cache: RetrievalCache,
    private readonly configService: ConfigService,
    @Inject(CHUNK_DATA_SOURCE)
    private readonly chunkDataSource: ChunkDataSource,
  ) {
    this.contextCacheTtlSeconds = Number(
      this.configService.get<string>('RETRIEVAL_CONTEXT_CACHE_TTL_SECONDS') ??
        300,
    );
  }

  async retrieve(params: SemanticSearchParams): Promise<RetrievedContext> {
    const startedAt = Date.now();
    const indexingRunIds =
      params.indexingRunIds ??
      (await this.chunkDataSource.listLiveIndexingRunIds(
        params.workspaceId,
        params.repositoryIds,
      ));
    if (indexingRunIds.length === 0) {
      this.metrics.recordSearch(Date.now() - startedAt, 0);
      return {
        chunks: [],
        symbols: [],
        files: [],
        references: [],
      };
    }

    const searchParams = {
      ...params,
      indexingRunIds,
    };
    const cacheKey = buildContextCacheKey(params.workspaceId, params.query, {
      repositoryIds: params.repositoryIds ?? [],
      indexingRunIds,
      language: params.language ?? null,
      symbolType: params.symbolType ?? null,
      branch: params.branch ?? null,
      topK: params.topK ?? 12,
    });

    const cached = await this.cache.get<RetrievedContext>(cacheKey);
    if (cached) {
      this.metrics.recordCacheHit();
      this.metrics.recordSearch(Date.now() - startedAt, cached.chunks.length);
      return cached;
    }
    this.metrics.recordCacheMiss();

    const candidates = await this.semanticSearchService.search(searchParams);
    const ranked = this.rankingService.rank(candidates);
    const context = await this.contextAssembler.assemble(ranked);

    await this.cache.set(cacheKey, context, this.contextCacheTtlSeconds);
    this.metrics.recordSearch(Date.now() - startedAt, context.chunks.length);
    return context;
  }

  getMetrics() {
    return {
      ...this.metrics.snapshot(),
      cacheHitRate: this.metrics.cacheHitRate(),
    };
  }
}
