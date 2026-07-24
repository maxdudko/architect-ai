import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';
import { SearchRankingService } from './search-ranking.service';

describe('SearchRankingService', () => {
  const baseCandidate = (
    overrides: Partial<ScoredChunkCandidate>,
  ): ScoredChunkCandidate => ({
    chunkId: 'chunk-1',
    score: 0.5,
    workspaceId: 'ws-1',
    repositoryId: 'repo-1',
    fileId: 'file-1',
    symbolId: 'symbol-1',
    filePath: 'src/a.ts',
    symbolName: 'A',
    qualifiedName: 'A',
    symbolType: 'CLASS',
    language: 'typescript',
    branch: 'main',
    createdAt: null,
    ...overrides,
  });

  it('ranks primarily by vector similarity', () => {
    const service = new SearchRankingService(new RetrievalMetricsService());
    const ranked = service.rank([
      baseCandidate({ chunkId: 'low', score: 0.2 }),
      baseCandidate({ chunkId: 'high', score: 0.9 }),
    ]);

    expect(ranked.map((item) => item.chunkId)).toEqual(['high', 'low']);
  });

  it('applies optional preference bonuses', () => {
    const service = new SearchRankingService(new RetrievalMetricsService());
    const ranked = service.rank(
      [
        baseCandidate({
          chunkId: 'other',
          score: 0.8,
          repositoryId: 'repo-2',
          filePath: 'src/b.ts',
          symbolId: 'symbol-2',
        }),
        baseCandidate({
          chunkId: 'preferred',
          score: 0.79,
          repositoryId: 'repo-1',
          filePath: 'src/a.ts',
          symbolId: 'symbol-1',
        }),
      ],
      {
        preferredRepositoryIds: ['repo-1'],
        preferredFilePaths: ['src/a.ts'],
        preferredSymbolIds: ['symbol-1'],
      },
    );

    const top = ranked[0];
    expect(top?.chunkId).toBe('preferred');
    expect(top?.score).toBeGreaterThan(0.79);
  });
});
