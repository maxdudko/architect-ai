import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { EmbeddingProvider } from '../../interfaces/embedding-provider.interface';
import { chunkArray } from '../../utils/batch.util';

/**
 * Deterministic local embedding provider for tests and local development.
 * Not suitable for production semantic quality.
 */
@Injectable()
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly batchSize: number;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('EMBEDDING_MODEL') ?? 'hash-embedding-v1';
    this.dimensions = Number(
      this.configService.get<string>('EMBEDDING_DIMENSIONS') ?? 1536,
    );
    this.batchSize = Number(
      this.configService.get<string>('EMBEDDING_BATCH_SIZE') ?? 64,
    );
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector ?? [];
  }

  embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return Promise.resolve([]);
    }

    const vectors: number[][] = [];
    for (const batch of chunkArray(texts, this.batchSize)) {
      for (const text of batch) {
        vectors.push(this.hashToVector(text));
      }
    }
    return Promise.resolve(vectors);
  }

  private hashToVector(text: string): number[] {
    const values: number[] = [];
    let seed = text;
    while (values.length < this.dimensions) {
      const digest = createHash('sha256').update(seed).digest();
      for (const byte of digest) {
        if (values.length >= this.dimensions) {
          break;
        }
        values.push(byte / 255);
      }
      seed = digest.toString('hex');
    }
    return values;
  }
}
