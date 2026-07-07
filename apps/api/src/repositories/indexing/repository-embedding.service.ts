import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RepositoriesRepository } from '../repositories.repository';

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

@Injectable()
export class RepositoryEmbeddingService {
  private readonly qdrantUrl: string;
  private readonly qdrantCollection: string;
  private readonly embeddingProvider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {
    this.qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ?? 'http://localhost:6333';
    this.qdrantCollection =
      this.configService.get<string>('QDRANT_COLLECTION') ??
      'repository_chunks';
    this.embeddingProvider =
      this.configService.get<string>('EMBEDDING_PROVIDER') ?? 'mock';
  }

  async embedRepository(data: {
    repositoryId: string;
    runId: string;
    branch: string;
    commitSha: string;
  }): Promise<{ embeddedCount: number }> {
    const chunks = await this.repositoriesRepository.listChunks(
      data.repositoryId,
      data.runId,
    );

    if (chunks.length === 0) {
      return { embeddedCount: 0 };
    }

    await this.ensureCollection();

    const points: QdrantPoint[] = chunks.map((chunk) => {
      const vector = this.generateEmbedding(chunk.content);
      return {
        id: chunk.id,
        vector,
        payload: {
          repositoryId: data.repositoryId,
          chunkId: chunk.id,
          filePath: chunk.filePath,
          branch: data.branch,
          commitSha: data.commitSha,
          language: chunk.language,
        },
      };
    });

    await this.upsertPoints(points);
    await this.repositoriesRepository.updateChunkVectorIds(
      data.repositoryId,
      data.runId,
      points.map((point) => ({
        chunkId: point.id,
        vectorId: point.id,
      })),
      this.embeddingProvider,
    );

    return { embeddedCount: points.length };
  }

  async deleteRepositoryVectors(repositoryId: string): Promise<void> {
    try {
      await this.qdrantRequest('/points/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: 'repositoryId',
                match: { value: repositoryId },
              },
            ],
          },
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isMissingCollectionError(message)) {
        return;
      }
      throw error;
    }
  }

  private async ensureCollection(): Promise<void> {
    const dimensions = 16;
    try {
      await this.qdrantRequest('', {
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

  private async upsertPoints(points: QdrantPoint[]): Promise<void> {
    await this.qdrantRequest('/points', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points,
      }),
    });
  }

  private generateEmbedding(content: string): number[] {
    const hash = createHash('sha256').update(content).digest();
    const values: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      values.push((hash[i] ?? 0) / 255);
    }
    return values;
  }

  private async qdrantRequest(
    pathSuffix: string,
    init: RequestInit,
  ): Promise<void> {
    const endpoint = `${this.qdrantUrl}/collections/${this.qdrantCollection}${pathSuffix}`;
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
