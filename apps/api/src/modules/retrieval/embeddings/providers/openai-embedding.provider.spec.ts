import { ConfigService } from '@nestjs/config';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';

describe('OpenAiEmbeddingProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('batches embedding requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { index: 1, embedding: [0.2, 0.3] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        }),
    });
    global.fetch = fetchMock as typeof fetch;

    const provider = new OpenAiEmbeddingProvider({
      get: (key: string) => {
        const values: Record<string, string> = {
          OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
          EMBEDDING_DIMENSIONS: '2',
          OPENAI_API_KEY: 'test-key',
          OPENAI_API_BASE_URL: 'https://api.openai.com/v1',
          EMBEDDING_BATCH_SIZE: '10',
        };
        return values[key];
      },
    } as ConfigService);

    const vectors = await provider.embedBatch(['one', 'two']);
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.2, 0.3],
    ]);

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body).toEqual({
      model: 'text-embedding-3-small',
      input: ['one', 'two'],
      dimensions: 2,
    });
  });

  it('requires an API key for openai provider usage', async () => {
    const provider = new OpenAiEmbeddingProvider({
      get: () => undefined,
    } as unknown as ConfigService);

    await expect(provider.embedBatch(['text'])).rejects.toThrow(
      'OPENAI_API_KEY is required',
    );
  });
});
