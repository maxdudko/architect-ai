import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { RetrievalCache } from '../interfaces/retrieval-cache.interface';
import { VectorStore } from '../interfaces/vector-store.interface';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { SemanticSearchService } from './semantic-search.service';

describe('SemanticSearchService', () => {
  it('embeds the query, applies filters, and returns candidates', async () => {
    const embeddingProvider: EmbeddingProvider = {
      model: 'hash-embedding-v1',
      dimensions: 8,
      embed: jest.fn().mockResolvedValue([0.1, 0.2]),
      embedBatch: jest.fn(),
    };
    const vectorStore: VectorStore = {
      createCollection: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteByRepository: jest.fn(),
      search: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          score: 0.88,
          payload: {
            chunkId: 'chunk-1',
            workspaceId: 'ws-1',
            repositoryId: 'repo-1',
            fileId: 'file-1',
            symbolId: 'symbol-1',
            filePath: 'src/a.ts',
            symbolName: 'AuthService',
            qualifiedName: 'AuthService',
            symbolType: 'CLASS',
            language: 'typescript',
            branch: 'main',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
      ]),
    };
    const cache: RetrievalCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };

    const service = new SemanticSearchService(
      embeddingProvider,
      vectorStore,
      cache,
      new RetrievalMetricsService(),
      {
        get: () => '60',
      } as unknown as ConfigService,
    );

    const results = await service.search({
      query: 'How does auth work?',
      workspaceId: 'ws-1',
      repositoryIds: ['repo-1'],
      language: 'typescript',
      topK: 5,
    });

    expect(embeddingProvider.embed).toHaveBeenCalledWith('How does auth work?');
    expect(vectorStore.search).toHaveBeenCalledWith(
      [0.1, 0.2],
      {
        must: [
          { field: 'workspaceId', operator: 'eq', value: 'ws-1' },
          { field: 'repositoryId', operator: 'eq', value: 'repo-1' },
          { field: 'language', operator: 'eq', value: 'typescript' },
        ],
      },
      expect.objectContaining({ topK: 5 }),
    );
    expect(results[0]?.chunkId).toBe('chunk-1');
    expect(results[0]?.score).toBe(0.88);
  });
});
