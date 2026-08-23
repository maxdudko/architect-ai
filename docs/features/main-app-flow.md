# Main App Flow

End-to-end path from connecting a repository to answering a chat question.

```text
Connect / retry / reindex
        ↓
BullMQ indexing jobs (worker)
        ↓
Clone → Parse → Chunk → Embed
        ↓                    ↓
   PostgreSQL            Qdrant
   (files, symbols,      (chunk vectors)
    relations, chunks)
        ↓
Chat ask / stream
        ↓
Retrieve → Prompt → LLM
        ↓
Answer + source citations
```

---

## 1. Connect a repository

**Who:** NestJS API (`apps/api`)

**Triggers:**

| Action         | Endpoint                                                  | Job trigger       |
| -------------- | --------------------------------------------------------- | ----------------- |
| Connect repo   | `POST /workspaces/:id/repositories`                       | `INITIAL_CONNECT` |
| Retry failed   | `POST /workspaces/:id/repositories/:repositoryId/retry`   | `MANUAL_RETRY`    |
| Manual reindex | `POST /workspaces/:id/repositories/:repositoryId/reindex` | `MANUAL_REINDEX`  |

The API authenticates the GitHub repo, creates/updates the `Repository` row, and enqueues work on the BullMQ queue `repository-indexing` (Redis). Indexing does **not** run in the API request path.

---

## 2. Indexing pipeline (worker)

**Who:** Dedicated worker (`apps/api/src/indexing-worker.ts`)

**Orchestrator:** `repository-indexing.worker.service.ts`

Stages run as chained BullMQ jobs (3 attempts, exponential backoff):

| Job       | Status                | What happens                                                                |
| --------- | --------------------- | --------------------------------------------------------------------------- |
| `reindex` | `PENDING`             | Create `IndexingRun`; wipe prior PG artifacts + Qdrant vectors for the repo |
| `clone`   | `CLONING`             | Shallow `git clone --depth 1` into temp storage (`INDEXING_TMP_DIR`)        |
| `parse`   | `PARSING`             | Tree-sitter code intelligence → files, symbols, relations                   |
| `chunk`   | `CHUNKING`            | One semantic chunk per meaningful symbol                                    |
| `embed`   | `EMBEDDING` → `READY` | Batch embed chunks; upsert Qdrant; mark repo ready                          |

On failure the repo is marked `FAILED` (with `indexingError`). Temp clone directories are cleaned up after embed or failure.

```text
PENDING → CLONING → PARSING → CHUNKING → EMBEDDING → READY
                                              ↘ FAILED
```

---

## 3. Code intelligence (parse + chunk)

**Who:** `apps/api/src/modules/code-intelligence/`

Invoked by the indexing worker’s `parse` and `chunk` jobs (not by chat).

```text
Scan files
  → Detect language (TypeScript / JavaScript / Python / PHP today)
  → Tree-sitter parse → AST
  → Upsert RepositoryFile inventory
  → Extract CodeSymbol (+ hierarchy, export/async/etc.)
  → Extract SymbolRelation (IMPORTS, EXPORTS, EXTENDS, IMPLEMENTS, CALLS, USES)
  → Persist to PostgreSQL; prune stale files
  → Build Chunk rows (source span per symbol)
```

**Stored in PostgreSQL:** `RepositoryFile`, `CodeSymbol`, `SymbolRelation`, `Chunk`

**Not produced here:** embeddings / vectors

Read APIs after index: `GET .../repositories/:id/files`, `GET .../repositories/:id/symbols`

---

## 4. Embedding and vector search

**Who:** `apps/api/src/modules/retrieval/`

### Index path (after chunk)

```text
List chunks for IndexingRun
  → EmbeddingProvider.embedBatch (OpenAI or mock)
  → VectorStore.upsert (Qdrant point id = chunk.id)
  → Update Chunk.vectorId + embeddingModel
```

### Query path (at chat time)

```text
User question
  → Embed query
  → Qdrant cosine search (filters: workspaceId, repositoryId, …)
  → Rank hits
  → Hydrate chunks / symbols / files from PostgreSQL
  → RetrievedContext
```

| Store                  | Role                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Qdrant**             | Vectors in collection `architect_chunks` (configurable); isolation via payload filters |
| **PostgreSQL `Chunk`** | Source of truth for content + `vectorId`                                               |
| **Redis** (optional)   | Query-embedding and assembled-context cache                                            |

There is no public HTTP search controller; retrieval is used by indexing (embed) and chat.

---

## 5. Chat interaction

**Who:** API `ChatService` + web chat UI (`apps/web/src/features/chat/`)

**Endpoints:**

| Endpoint                                     | Behavior                                      |
| -------------------------------------------- | --------------------------------------------- |
| `POST /workspaces/:id/conversations`         | Create conversation (optional `repositoryId`) |
| `POST .../conversations/:id/messages`        | Full answer                                   |
| `POST .../conversations/:id/messages/stream` | SSE stream                                    |

### Turn flow

```text
Load conversation + recent history (~12 messages)
  → Persist USER message
  → RetrievalService.retrieve (topK ≈ 12, scoped to conversation repo when set)
  → PromptContextBuilder (system + repo meta + chunks + history + question)
  → LLM generate or stream (mock | openai | anthropic)
  → Persist ASSISTANT message (metadata: sources, model, usage)
```

### SSE stream events

```text
sources → token* → message → done
```

**Stored in PostgreSQL:** `Conversation`, `Message`  
Chat does not write vectors; it reads Qdrant + PG at ask time.

---

## Design boundaries

1. **Indexing ≠ chat** — queue/worker vs request path
2. **Code intelligence ≠ embeddings** — symbols/chunks first; retrieval embeds later
3. **Retrieval ≠ LLM** — chat consumes `RetrievedContext`, then builds prompts
4. **Adapters** — `EmbeddingProvider`, `VectorStore`, `LlmProvider` swap via env

---

## Key entrypoints

| Area              | Path                                      |
| ----------------- | ----------------------------------------- |
| Repo API          | `apps/api/src/repositories/`              |
| Indexing worker   | `apps/api/src/indexing-worker.ts`         |
| Indexing jobs     | `apps/api/src/repositories/indexing/`     |
| Code intelligence | `apps/api/src/modules/code-intelligence/` |
| Retrieval         | `apps/api/src/modules/retrieval/`         |
| Chat API          | `apps/api/src/chat/`                      |
| Chat UI           | `apps/web/src/features/chat/`             |

Related docs: [Architecture](../Architecture.md), [code intelligence](./code-intelligence.md), [retrieval](./retrieval.md)
