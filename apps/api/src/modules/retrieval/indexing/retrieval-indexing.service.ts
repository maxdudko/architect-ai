import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { VectorStore } from '../interfaces/vector-store.interface';
import {
  CHUNK_DATA_SOURCE,
  EMBEDDING_PROVIDER,
  VECTOR_STORE,
} from '../interfaces/tokens';
import { RetrievalMetricsService } from '../metrics/retrieval-metrics.service';
import { toChunkVectorPayload } from '../types/chunk-for-indexing.type';
import type { VectorPoint } from '../types/vector-point.type';
import { chunkArray } from '../utils/batch.util';
import { asPayloadRecord } from '../utils/payload.mapper';

export interface IndexRepositoryChunksParams {
  workspaceId: string;
  repositoryId: string;
  indexingRunId: string;
  branch: string;
}

@Injectable()
export class RetrievalIndexingService implements OnModuleInit {
  private readonly logger = new Logger(RetrievalIndexingService.name);
  private readonly batchSize: number;

  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    @Inject(VECTOR_STORE)
    private readonly vectorStore: VectorStore,
    @Inject(CHUNK_DATA_SOURCE)
    private readonly chunkDataSource: ChunkDataSource,
    private readonly metrics: RetrievalMetricsService,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = Number(
      this.configService.get<string>('EMBEDDING_BATCH_SIZE') ?? 64,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.backfillIndexingRunPayloads();
    } catch (error) {
      this.logger.warn(
        `Failed to backfill Qdrant indexingRunId payloads: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async indexRepositoryChunks(
    params: IndexRepositoryChunksParams,
  ): Promise<{ embeddedCount: number }> {
    const chunks = await this.chunkDataSource.listChunksForIndexing(
      params.repositoryId,
      params.indexingRunId,
    );

    await this.vectorStore.createCollection(this.embeddingProvider.dimensions);

    if (chunks.length === 0) {
      return { embeddedCount: 0 };
    }

    let embeddedCount = 0;
    for (const batch of chunkArray(chunks, this.batchSize)) {
      const embeddingStartedAt = Date.now();
      const vectors = await this.embeddingProvider.embedBatch(
        batch.map((chunk) => chunk.content),
      );
      this.metrics.recordEmbedding(
        Date.now() - embeddingStartedAt,
        batch.length,
      );

      const points: VectorPoint[] = batch.map((chunk, index) => {
        const vector = vectors[index];
        if (!vector) {
          throw new Error(
            `Embedding provider returned fewer vectors than inputs (missing index ${index})`,
          );
        }

        return {
          id: chunk.id,
          vector,
          payload: asPayloadRecord(
            toChunkVectorPayload({
              ...chunk,
              workspaceId: params.workspaceId,
              indexingRunId: params.indexingRunId,
              branch: params.branch || chunk.branch,
            }),
          ),
        };
      });

      await this.vectorStore.upsert(points);
      embeddedCount += points.length;
    }

    return { embeddedCount };
  }

  async deleteRepositoryVectors(repositoryId: string): Promise<void> {
    await this.vectorStore.deleteByRepository(repositoryId);
  }

  async deleteIndexingRunVectors(indexingRunId: string): Promise<void> {
    await this.vectorStore.deleteByIndexingRun(indexingRunId);
  }

  async backfillIndexingRunPayloads(): Promise<void> {
    const groups =
      await this.chunkDataSource.listVectorizedChunksByIndexingRun();
    if (groups.length === 0) {
      return;
    }

    for (const group of groups) {
      try {
        await this.vectorStore.setPayload(group.chunkIds, {
          indexingRunId: group.indexingRunId,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to backfill indexingRunId ${group.indexingRunId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  getEmbeddingModel(): string {
    return this.embeddingProvider.model;
  }
}
