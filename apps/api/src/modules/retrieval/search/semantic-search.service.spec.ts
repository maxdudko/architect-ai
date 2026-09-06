import { ConfigService } from '@nestjs/config';
import { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { RetrievalCache } from '../interfaces/retrieval-cache.interface';
import { VectorStore } from '../interfaces/vector-store.interface';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { SemanticSearchService } from './semantic-search.service';

describe('SemanticSearchService', () => {
  const embeddingProvider: EmbeddingProvider = {
    model: 'hash-embedding-v1',
    dimensions: 8,
    embed: jest.fn().mockResolvedValue([0.1, 0.2]),
    embedBatch: jest.fn(),
  };
  const cache: RetrievalCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
  };

  function createVectorStore(
    search = jest.fn().mockResolvedValue([]),
  ): VectorStore {
    return {
      createCollection: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteByRepository: jest.fn(),
      deleteByIndexingRun: jest.fn(),
      setPayload: jest.fn(),
      search,
    };
  }

  it('embeds the query, applies live-run filters, and returns candidates', async () => {
    const vectorStore = createVectorStore(
      jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          score: 0.88,
          payload: {
            chunkId: 'chunk-1',
            workspaceId: 'ws-1',
            repositoryId: 'repo-1',
            indexingRunId: 'run-1',
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
    );
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn(),
      getChunksByIds: jest.fn(),
      listLiveIndexingRunIds: jest.fn().mockResolvedValue(['run-1']),
      listVectorizedChunksByIndexingRun: jest.fn(),
    };

    const service = new SemanticSearchService(
      embeddingProvider,
      vectorStore,
      cache,
      new RetrievalMetricsService(),
      {
        get: () => '60',
      } as unknown as ConfigService,
      chunkDataSource,
    );

    const results = await service.search({
      query: 'How does auth work?',
      workspaceId: 'ws-1',
      repositoryIds: ['repo-1'],
      language: 'typescript',
      topK: 5,
    });

    expect(embeddingProvider.embed).toHaveBeenCalledWith('How does auth work?');
    expect(chunkDataSource.listLiveIndexingRunIds).toHaveBeenCalledWith(
      'ws-1',
      ['repo-1'],
    );
    expect(vectorStore.search).toHaveBeenCalledWith(
      [0.1, 0.2],
      {
        must: [
          { field: 'workspaceId', operator: 'eq', value: 'ws-1' },
          { field: 'indexingRunId', operator: 'eq', value: 'run-1' },
          { field: 'repositoryId', operator: 'eq', value: 'repo-1' },
          { field: 'language', operator: 'eq', value: 'typescript' },
        ],
      },
      expect.objectContaining({ topK: 5 }),
    );
    expect(results[0]?.chunkId).toBe('chunk-1');
    expect(results[0]?.score).toBe(0.88);
  });

  it('returns no candidates when there is no live indexing run', async () => {
    const vectorStore = createVectorStore();
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn(),
      getChunksByIds: jest.fn(),
      listLiveIndexingRunIds: jest.fn().mockResolvedValue([]),
      listVectorizedChunksByIndexingRun: jest.fn(),
    };

    const service = new SemanticSearchService(
      embeddingProvider,
      vectorStore,
      cache,
      new RetrievalMetricsService(),
      {
        get: () => '60',
      } as unknown as ConfigService,
      chunkDataSource,
    );

    const results = await service.search({
      query: 'How does auth work?',
      workspaceId: 'ws-1',
      repositoryIds: ['repo-1'],
    });

    expect(results).toEqual([]);
    expect(vectorStore.search).not.toHaveBeenCalled();
  });
});
