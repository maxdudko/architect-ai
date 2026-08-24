import { ConfigService } from '@nestjs/config';
import { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { VectorStore } from '../interfaces/vector-store.interface';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { RetrievalIndexingService } from './retrieval-indexing.service';

describe('RetrievalIndexingService', () => {
  it('batch embeds chunks and upserts vectors with payload metadata', async () => {
    const embeddingProvider: EmbeddingProvider = {
      model: 'hash-embedding-v1',
      dimensions: 4,
      embed: jest.fn(),
      embedBatch: jest.fn().mockResolvedValue([
        [0.1, 0.2, 0.3, 0.4],
        [0.5, 0.6, 0.7, 0.8],
      ]),
    };
    const vectorStore: VectorStore = {
      createCollection: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      deleteByRepository: jest.fn(),
      deleteByIndexingRun: jest.fn(),
      setPayload: jest.fn(),
      search: jest.fn(),
    };
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'one',
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          indexingRunId: 'run-1',
          fileId: 'file-1',
          symbolId: 'symbol-1',
          filePath: 'a.ts',
          symbolName: 'One',
          qualifiedName: 'One',
          symbolType: 'CLASS',
          language: 'typescript',
          branch: 'main',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'chunk-2',
          content: 'two',
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          indexingRunId: 'run-1',
          fileId: 'file-2',
          symbolId: null,
          filePath: 'b.ts',
          symbolName: null,
          qualifiedName: null,
          symbolType: null,
          language: 'typescript',
          branch: 'main',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
      getChunksByIds: jest.fn(),
      listLiveIndexingRunIds: jest.fn(),
      listVectorizedChunksByIndexingRun: jest.fn(),
    };

    const service = new RetrievalIndexingService(
      embeddingProvider,
      vectorStore,
      chunkDataSource,
      new RetrievalMetricsService(),
      {
        get: (key: string) =>
          key === 'EMBEDDING_BATCH_SIZE' ? '64' : undefined,
      } as unknown as ConfigService,
    );

    const result = await service.indexRepositoryChunks({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      indexingRunId: 'run-1',
      branch: 'develop',
    });

    expect(result.embeddedCount).toBe(2);
    expect(vectorStore.createCollection).toHaveBeenCalledWith(4);
    expect(embeddingProvider.embedBatch).toHaveBeenCalledWith(['one', 'two']);
    expect(vectorStore.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'chunk-1',
        payload: expect.objectContaining({
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          indexingRunId: 'run-1',
          chunkId: 'chunk-1',
          branch: 'develop',
          symbolName: 'One',
        }),
      }),
      expect.objectContaining({
        id: 'chunk-2',
        payload: expect.objectContaining({
          chunkId: 'chunk-2',
          symbolId: null,
        }),
      }),
    ]);
  });

  it('still creates the vector collection when there are no chunks', async () => {
    const embeddingProvider: EmbeddingProvider = {
      model: 'hash-embedding-v1',
      dimensions: 4,
      embed: jest.fn(),
      embedBatch: jest.fn(),
    };
    const vectorStore: VectorStore = {
      createCollection: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteByRepository: jest.fn(),
      deleteByIndexingRun: jest.fn(),
      setPayload: jest.fn(),
      search: jest.fn(),
    };
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn().mockResolvedValue([]),
      getChunksByIds: jest.fn(),
      listLiveIndexingRunIds: jest.fn(),
      listVectorizedChunksByIndexingRun: jest.fn(),
    };

    const service = new RetrievalIndexingService(
      embeddingProvider,
      vectorStore,
      chunkDataSource,
      new RetrievalMetricsService(),
      {
        get: () => undefined,
      } as unknown as ConfigService,
    );

    const result = await service.indexRepositoryChunks({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      indexingRunId: 'run-1',
      branch: 'main',
    });

    expect(result.embeddedCount).toBe(0);
    expect(vectorStore.createCollection).toHaveBeenCalledWith(4);
    expect(embeddingProvider.embedBatch).not.toHaveBeenCalled();
    expect(vectorStore.upsert).not.toHaveBeenCalled();
  });

  it('backfills indexingRunId onto existing vector payloads', async () => {
    const vectorStore: VectorStore = {
      createCollection: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteByRepository: jest.fn(),
      deleteByIndexingRun: jest.fn(),
      setPayload: jest.fn().mockResolvedValue(undefined),
      search: jest.fn(),
    };
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn(),
      getChunksByIds: jest.fn(),
      listLiveIndexingRunIds: jest.fn(),
      listVectorizedChunksByIndexingRun: jest
        .fn()
        .mockResolvedValue([
          { indexingRunId: 'run-1', chunkIds: ['chunk-1', 'chunk-2'] },
        ]),
    };

    const service = new RetrievalIndexingService(
      {
        model: 'hash-embedding-v1',
        dimensions: 4,
        embed: jest.fn(),
        embedBatch: jest.fn(),
      },
      vectorStore,
      chunkDataSource,
      new RetrievalMetricsService(),
      { get: () => undefined } as unknown as ConfigService,
    );

    await service.backfillIndexingRunPayloads();

    expect(vectorStore.setPayload).toHaveBeenCalledWith(
      ['chunk-1', 'chunk-2'],
      { indexingRunId: 'run-1' },
    );
  });
});
