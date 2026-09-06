import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStore } from '../interfaces/vector-store.interface';
import { SearchFilter } from '../types/search-filter.type';
import { VectorPoint } from '../types/vector-point.type';
import { VectorSearchHit } from '../types/vector-search-hit.type';
import { VectorSearchOptions } from '../types/vector-search-options.type';
import { chunkArray } from '../utils/batch.util';

interface QdrantSearchResponse {
  result: Array<{
    id: string | number;
    score: number;
    payload?: Record<string, unknown> | null;
  }>;
}

@Injectable()
export class QdrantVectorStore implements VectorStore {
  private readonly logger = new Logger(QdrantVectorStore.name);
  private readonly qdrantUrl: string;
  private readonly collectionName: string;
  private readonly upsertBatchSize: number;

  constructor(private readonly configService: ConfigService) {
    this.qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ?? 'http://localhost:6333';
    this.collectionName =
      this.configService.get<string>('QDRANT_COLLECTION') ?? 'architect_chunks';
    this.upsertBatchSize = Number(
      this.configService.get<string>('QDRANT_UPSERT_BATCH_SIZE') ?? 128,
    );
  }

  async createCollection(dimensions: number): Promise<void> {
    try {
      await this.request('', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: {
            size: dimensions,
            distance: 'Cosine',
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isCollectionAlreadyExistsError(message)) {
        return;
      }
      throw error;
    }
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }

    for (const batch of chunkArray(points, this.upsertBatchSize)) {
      await this.request('/points?wait=true', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: batch }),
      });
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.request('/points/delete?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: ids }),
    });
  }

  async deleteByRepository(repositoryId: string): Promise<void> {
    await this.deleteByPayloadField('repositoryId', repositoryId);
  }

  async deleteByIndexingRun(indexingRunId: string): Promise<void> {
    await this.deleteByPayloadField('indexingRunId', indexingRunId);
  }

  async setPayload(
    pointIds: string[],
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (pointIds.length === 0) {
      return;
    }

    try {
      for (const batch of chunkArray(pointIds, this.upsertBatchSize)) {
        await this.request('/points/payload?wait=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload,
            points: batch,
          }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isMissingCollectionError(message)) {
        this.logger.debug(
          `Skipping setPayload; collection ${this.collectionName} does not exist`,
        );
        return;
      }
      throw error;
    }
  }

  private async deleteByPayloadField(
    key: string,
    value: string,
  ): Promise<void> {
    try {
      await this.request('/points/delete?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key,
                match: { value },
              },
            ],
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isMissingCollectionError(message)) {
        this.logger.debug(
          `Skipping delete by ${key}; collection ${this.collectionName} does not exist`,
        );
        return;
      }
      throw error;
    }
  }

  async search(
    vector: number[],
    filter: SearchFilter | undefined,
    options: VectorSearchOptions,
  ): Promise<VectorSearchHit[]> {
    const body: Record<string, unknown> = {
      vector,
      limit: options.topK,
      with_payload: options.withPayload ?? true,
    };

    if (filter && filter.must.length > 0) {
      body.filter = this.toQdrantFilter(filter);
    }
    if (options.scoreThreshold !== undefined) {
      body.score_threshold = options.scoreThreshold;
    }

    try {
      const response = await this.requestJson<QdrantSearchResponse>(
        '/points/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      return (response.result ?? []).map((item) => ({
        id: String(item.id),
        score: item.score,
        payload: item.payload ?? {},
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isMissingCollectionError(message)) {
        this.logger.debug(
          `Skipping search; collection ${this.collectionName} does not exist`,
        );
        return [];
      }
      throw error;
    }
  }

  private toQdrantFilter(filter: SearchFilter): Record<string, unknown> {
    return {
      must: filter.must.map((condition) => {
        if (condition.operator === 'any') {
          const values = Array.isArray(condition.value)
            ? condition.value
            : [condition.value];
          return {
            key: condition.field,
            match: { any: values },
          };
        }

        return {
          key: condition.field,
          match: { value: condition.value },
        };
      }),
    };
  }

  private async request(pathSuffix: string, init: RequestInit): Promise<void> {
    await this.requestJson<unknown>(pathSuffix, init);
  }

  private async requestJson<T>(
    pathSuffix: string,
    init: RequestInit,
  ): Promise<T> {
    const endpoint = `${this.qdrantUrl}/collections/${this.collectionName}${pathSuffix}`;
    let response: Response;
    try {
      response = await fetch(endpoint, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to reach Qdrant at ${endpoint}. Check QDRANT_URL and that Qdrant is running. Cause: ${message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Qdrant request failed (${response.status}) at ${endpoint}. Response: ${body || '<empty>'}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private isMissingCollectionError(message: string): boolean {
    return (
      message.includes('Qdrant request failed (404)') &&
      message.includes("doesn't exist")
    );
  }

  private isCollectionAlreadyExistsError(message: string): boolean {
    return (
      message.includes('Qdrant request failed (409)') &&
      message.includes('already exists')
    );
  }
}
