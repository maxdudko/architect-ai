import { Injectable } from '@nestjs/common';

export interface RetrievalMetricsSnapshot {
  searchCount: number;
  searchDurationMsTotal: number;
  embeddingCount: number;
  embeddingDurationMsTotal: number;
  vectorSearchCount: number;
  vectorSearchDurationMsTotal: number;
  rankingCount: number;
  rankingDurationMsTotal: number;
  retrievedChunkCountTotal: number;
  cacheHits: number;
  cacheMisses: number;
}

@Injectable()
export class RetrievalMetricsService {
  private readonly metrics: RetrievalMetricsSnapshot = {
    searchCount: 0,
    searchDurationMsTotal: 0,
    embeddingCount: 0,
    embeddingDurationMsTotal: 0,
    vectorSearchCount: 0,
    vectorSearchDurationMsTotal: 0,
    rankingCount: 0,
    rankingDurationMsTotal: 0,
    retrievedChunkCountTotal: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  recordSearch(durationMs: number, retrievedChunkCount: number): void {
    this.metrics.searchCount += 1;
    this.metrics.searchDurationMsTotal += durationMs;
    this.metrics.retrievedChunkCountTotal += retrievedChunkCount;
  }

  recordEmbedding(durationMs: number, textCount: number): void {
    this.metrics.embeddingCount += textCount;
    this.metrics.embeddingDurationMsTotal += durationMs;
  }

  recordVectorSearch(durationMs: number): void {
    this.metrics.vectorSearchCount += 1;
    this.metrics.vectorSearchDurationMsTotal += durationMs;
  }

  recordRanking(durationMs: number): void {
    this.metrics.rankingCount += 1;
    this.metrics.rankingDurationMsTotal += durationMs;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses += 1;
  }

  snapshot(): RetrievalMetricsSnapshot {
    return { ...this.metrics };
  }

  cacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) {
      return 0;
    }
    return this.metrics.cacheHits / total;
  }
}
