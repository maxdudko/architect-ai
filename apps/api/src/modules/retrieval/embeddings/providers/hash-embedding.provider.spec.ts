import { ConfigService } from '@nestjs/config';
import { HashEmbeddingProvider } from './hash-embedding.provider';

describe('HashEmbeddingProvider', () => {
  const provider = new HashEmbeddingProvider({
    get: (key: string) => {
      const values: Record<string, string> = {
        EMBEDDING_MODEL: 'hash-embedding-v1',
        EMBEDDING_DIMENSIONS: '8',
        EMBEDDING_BATCH_SIZE: '2',
      };
      return values[key];
    },
  } as ConfigService);

  it('embeds a single text to configured dimensions', async () => {
    const vector = await provider.embed('hello world');
    expect(vector).toHaveLength(8);
    expect(vector.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('embeds batches without calling one-at-a-time externally', async () => {
    const vectors = await provider.embedBatch(['a', 'b', 'c']);
    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(8);
    expect(vectors[0]).not.toEqual(vectors[1]);
  });

  it('is deterministic for the same input', async () => {
    const first = await provider.embed('stable');
    const second = await provider.embed('stable');
    expect(first).toEqual(second);
  });
});
