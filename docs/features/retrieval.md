# Retrieval Infrastructure

## Goals

The Retrieval layer turns semantic chunks into searchable knowledge and assembles
LLM-ready context. It is intentionally independent from:

- Code Intelligence / Tree-sitter parsing
- Any specific LLM runtime
- Any specific embedding vendor (OpenAI is an adapter)
- Any specific vector database (Qdrant is an adapter)

## Module Layout

`apps/api/src/modules/retrieval/`

- `embeddings/providers/` — `EmbeddingProvider` adapters (`openai`, `hash`/`mock`)
- `vector-store/` — `VectorStore` adapters (`QdrantVectorStore`)
- `search/` — filter builder + semantic search
- `ranking/` — candidate ranking (similarity + future bonuses)
- `context/` — `RetrievedContext` assembly
- `cache/` — Redis cache with in-memory fallback
- `indexing/` — batch embed + upsert orchestration + chunk data source
- `metrics/` — in-process latency/count metrics
- `interfaces/`, `types/`, `dto/`, `utils/`

## Pipeline

```text
Question
  → SemanticSearchService (embed query + vector search + metadata filters)
  → SearchRankingService
  → ContextAssemblerService
  → RetrievedContext
  → LLM / Chat / Architecture Explorer
```

Indexing path (worker orchestration only):

```text
Chunk stage complete
  → RepositoryEmbeddingService (thin facade)
  → RetrievalIndexingService
  → EmbeddingProvider.embedBatch
  → VectorStore.upsert
```

## Abstractions Contracts

### EmbeddingProvider

- `embed(text)`
- `embedBatch(texts)`
- Never embed one chunk at a time in indexing; always batch.

Current adapters:

- `OpenAiEmbeddingProvider` → `text-embedding-3-small`
- `HashEmbeddingProvider` → deterministic local vectors for tests/dev (`EMBEDDING_PROVIDER=mock`)

Future adapters can add Voyage, Jina, BGE, Ollama without changing callers.

### VectorStore

- `createCollection(dimensions)`
- `upsert(points)`
- `delete(ids)`
- `deleteByRepository(repositoryId)`
- `deleteByIndexingRun(indexingRunId)`
- `setPayload(pointIds, payload)`
- `search(vector, filter, options)`

Qdrant types stay inside `QdrantVectorStore`.

Collection: `architect_chunks` (single shared collection). Isolation is payload-based
(`workspaceId`, `repositoryId`, `indexingRunId`, optional `language` / `symbolType` / `branch`). Chat and browse pin to the latest `SUCCEEDED` indexing run per repository.

### Payload Metadata

Every vector stores:

- `workspaceId`, `repositoryId`, `indexingRunId`, `chunkId`
- `symbolId`, `fileId`, `filePath`
- `symbolName`, `qualifiedName`, `symbolType`
- `language`, `branch`, `createdAt`

### SearchFilterBuilder

Provider-agnostic filter tree. Adapters translate to store-specific filters.

### RetrievedContext

Never return raw hits. Assemble:

```ts
{
  chunks: [],
  symbols: [],
  files: [],
  references: []
}
```

Grouped by repository → file → symbol, with duplicate span removal.

## Configuration

| Variable                                      | Default                  | Purpose                             |
| --------------------------------------------- | ------------------------ | ----------------------------------- |
| `EMBEDDING_PROVIDER`                          | `mock`                   | `mock` or `openai`                  |
| `EMBEDDING_DIMENSIONS`                        | `1536`                   | Must match collection vector size   |
| `EMBEDDING_BATCH_SIZE`                        | `64`                     | Batch size for embed + upsert loops |
| `OPENAI_API_KEY`                              |                          | Required for `openai`               |
| `OPENAI_EMBEDDING_MODEL`                      | `text-embedding-3-small` | Model id                            |
| `QDRANT_URL`                                  |                          | Vector DB endpoint                  |
| `QDRANT_COLLECTION`                           | `architect_chunks`       | Shared collection name              |
| `RETRIEVAL_CACHE_DRIVER`                      | `redis`                  | `redis` or `memory`                 |
| `RETRIEVAL_CONTEXT_CACHE_TTL_SECONDS`         | `300`                    | Context cache TTL                   |
| `RETRIEVAL_QUERY_EMBEDDING_CACHE_TTL_SECONDS` | `3600`                   | Query embedding TTL                 |

## Schema Decisions

No Prisma migration was required.

- `Chunk` already stores content, symbol/file linkage, `vectorId`, and `embeddingModel`.
- `workspaceId` and `branch` are resolved at index time from `Repository` / `IndexingRun`.
- Optional future denormalization: persist `workspaceId` on `Chunk` if query patterns need it without joins.

## Metrics

`RetrievalMetricsService` tracks:

- Search duration
- Embedding duration / count
- Vector search latency
- Ranking latency
- Retrieved chunk count
- Cache hit/miss rate

Exposed via `RetrievalService.getMetrics()` for future Prometheus wiring.

## Extension Points

- Add embedding vendors under `embeddings/providers/`
- Add vector backends under `vector-store/`
- Extend ranking bonuses in `SearchRankingService` (recency, ownership, conversation)
- Hybrid search can be added behind `VectorStore.search` without changing consumers
