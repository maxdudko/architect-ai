import { ConfigService } from '@nestjs/config';
import { QdrantVectorStore } from './qdrant.vector-store';

describe('QdrantVectorStore', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  function createStore(): QdrantVectorStore {
    return new QdrantVectorStore({
      get: (key: string) => {
        const values: Record<string, string> = {
          QDRANT_URL: 'http://localhost:6333',
          QDRANT_COLLECTION: 'architect_chunks',
          QDRANT_UPSERT_BATCH_SIZE: '2',
        };
        return values[key];
      },
    } as ConfigService);
  }

  it('creates collections and upserts points in batches', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    });
    global.fetch = fetchMock as typeof fetch;

    const store = createStore();
    await store.createCollection(1536);
    await store.upsert([
      { id: '1', vector: [0.1], payload: { repositoryId: 'r1' } },
      { id: '2', vector: [0.2], payload: { repositoryId: 'r1' } },
      { id: '3', vector: [0.3], payload: { repositoryId: 'r1' } },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6333/collections/architect_chunks',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('translates provider-agnostic filters for search', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            result: [
              {
                id: 'chunk-1',
                score: 0.91,
                payload: { chunkId: 'chunk-1', workspaceId: 'ws-1' },
              },
            ],
          }),
        ),
    });
    global.fetch = fetchMock as typeof fetch;

    const store = createStore();
    const hits = await store.search(
      [0.1, 0.2],
      {
        must: [
          { field: 'workspaceId', operator: 'eq', value: 'ws-1' },
          {
            field: 'repositoryId',
            operator: 'any',
            value: ['repo-1', 'repo-2'],
          },
        ],
      },
      { topK: 5, withPayload: ['chunkId', 'workspaceId'] },
    );

    expect(hits).toEqual([
      {
        id: 'chunk-1',
        score: 0.91,
        payload: { chunkId: 'chunk-1', workspaceId: 'ws-1' },
      },
    ]);

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.filter).toEqual({
      must: [
        { key: 'workspaceId', match: { value: 'ws-1' } },
        { key: 'repositoryId', match: { any: ['repo-1', 'repo-2'] } },
      ],
    });
  });

  it('deletes by repository using payload filters', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    });
    global.fetch = fetchMock as typeof fetch;

    const store = createStore();
    await store.deleteByRepository('repo-1');

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.filter.must[0]).toEqual({
      key: 'repositoryId',
      match: { value: 'repo-1' },
    });
  });

  it('returns empty search hits when the collection is missing', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            status: {
              error: "Not found: Collection `architect_chunks` doesn't exist!",
            },
          }),
        ),
    });
    global.fetch = fetchMock as typeof fetch;

    const store = createStore();
    const hits = await store.search([0.1], undefined, { topK: 5 });

    expect(hits).toEqual([]);
  });
});
