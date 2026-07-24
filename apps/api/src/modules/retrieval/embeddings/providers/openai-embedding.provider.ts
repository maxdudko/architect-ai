import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from '../../interfaces/embedding-provider.interface';
import { chunkArray } from '../../utils/batch.util';

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

@Injectable()
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAiEmbeddingProvider.name);
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly batchSize: number;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
      'text-embedding-3-small';
    this.dimensions = Number(
      this.configService.get<string>('EMBEDDING_DIMENSIONS') ?? 1536,
    );
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.apiBaseUrl =
      this.configService.get<string>('OPENAI_API_BASE_URL') ??
      'https://api.openai.com/v1';
    this.batchSize = Number(
      this.configService.get<string>('EMBEDDING_BATCH_SIZE') ?? 64,
    );
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    if (!vector) {
      throw new Error('OpenAI embedding provider returned an empty result');
    }
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    if (!this.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai',
      );
    }

    const vectors: number[][] = [];

    for (const batch of chunkArray(texts, this.batchSize)) {
      const batchVectors = await this.requestEmbeddings(batch);
      vectors.push(...batchVectors);
    }

    return vectors;
  }

  private async requestEmbeddings(texts: string[]): Promise<number[][]> {
    const endpoint = `${this.apiBaseUrl}/embeddings`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to reach OpenAI embeddings API at ${endpoint}. Cause: ${message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `OpenAI embeddings request failed (${response.status}): ${body}`,
      );
      throw new Error(
        `OpenAI embeddings request failed (${response.status}): ${body || '<empty>'}`,
      );
    }

    const payload = (await response.json()) as OpenAiEmbeddingResponse;
    const sorted = [...payload.data].sort(
      (left, right) => left.index - right.index,
    );
    return sorted.map((item) => item.embedding);
  }
}
