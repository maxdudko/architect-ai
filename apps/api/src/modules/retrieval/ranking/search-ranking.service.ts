import { Injectable } from '@nestjs/common';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';

export interface RankingHints {
  preferredRepositoryIds?: string[];
  preferredFilePaths?: string[];
  preferredSymbolIds?: string[];
}

@Injectable()
export class SearchRankingService {
  constructor(private readonly metrics: RetrievalMetricsService) {}

  /**
   * Initial ranking uses vector similarity. Extension points below allow
   * future bonuses without coupling to the vector store.
   */
  rank(
    candidates: ScoredChunkCandidate[],
    hints: RankingHints = {},
  ): ScoredChunkCandidate[] {
    const startedAt = Date.now();
    const preferredRepositories = new Set(hints.preferredRepositoryIds ?? []);
    const preferredFiles = new Set(hints.preferredFilePaths ?? []);
    const preferredSymbols = new Set(hints.preferredSymbolIds ?? []);

    const ranked = candidates
      .map((candidate) => {
        let score = candidate.score;

        if (preferredRepositories.has(candidate.repositoryId)) {
          score += 0.02;
        }
        if (preferredFiles.has(candidate.filePath)) {
          score += 0.03;
        }
        if (candidate.symbolId && preferredSymbols.has(candidate.symbolId)) {
          score += 0.05;
        }

        return {
          ...candidate,
          score,
        };
      })
      .sort((left, right) => right.score - left.score);

    this.metrics.recordRanking(Date.now() - startedAt);
    return ranked;
  }
}
