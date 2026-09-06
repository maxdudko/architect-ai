# Main App Flow

End-to-end path from connecting a repository to chat and living onboarding guides.

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
        ├─ Chat ask / stream → Retrieve → Prompt → LLM → Answer + citations
        └─ Queue onboarding-guide generation → topology + retrieval → Markdown guides
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

A workspace member can pick a repository from the connected GitHub account or paste a public `owner/repo` URL. Public URLs are resolved with `GET /integrations/github/resolve` before `POST /workspaces/:id/repositories`.

---

## 2. Indexing pipeline (worker)

**Who:** Dedicated worker (`apps/api/src/indexing-worker.ts`)

**Orchestrator:** `repository-indexing.worker.service.ts`

Stages run as chained BullMQ jobs (3 attempts, exponential backoff). The Status column is the repository status **while that job runs** (the job then advances status before enqueueing the next stage):

| Job       | Status                | What happens                                                                                              |
| --------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `reindex` | `CLONING`             | Create a new `IndexingRun` alongside the live index; set status `CLONING`; do not wipe prior artifacts    |
| `clone`   | `CLONING`             | Shallow `git clone --depth 1` into temp storage (`INDEXING_TMP_DIR`)                                      |
| `parse`   | `PARSING`             | Tree-sitter code intelligence → files, symbols, relations for this run                                    |
| `chunk`   | `CHUNKING`            | One semantic chunk per meaningful symbol                                                                  |
| `embed`   | `EMBEDDING` → `READY` | Batch embed chunks; upsert Qdrant; mark repo ready; delete the previous generation; enqueue living guides |

The connect HTTP handler first persists the repository as `PENDING`, then enqueues `reindex`. The `reindex` job itself sets `CLONING` before clone starts.

On first-time failure the repo is marked `FAILED` (with `indexingError`). If a previous successful index exists, a failed rebuild restores `READY` and keeps that index searchable. Temp clone directories are cleaned up after embed or failure. Guide enqueue failures are logged and do not roll the repository back from `READY`.

Diagram (the `.mmd` file is canonical; the PNG is generated from it): [Repository Indexing Workflow](./Repository%20Indexing%20Workflow.mmd).

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

There is no public HTTP search controller; retrieval is used by indexing (embed), chat, and onboarding-guide generation.

---

## 5. Chat interaction

**Who:** API `ChatService` + web chat UI (`apps/web/src/features/chat/`)

**Endpoints:**

| Endpoint                                     | Behavior                                      |
| -------------------------------------------- | --------------------------------------------- |
| `POST /workspaces/:id/conversations`         | Create conversation (optional `repositoryId`) |
| `POST .../conversations/:id/messages`        | Full answer                                   |
| `POST .../conversations/:id/messages/stream` | SSE stream                                    |

Omitting `repositoryId` searches ready repositories in the active workspace. Setting it scopes retrieval to that repository.

### Turn flow

```text
Load conversation + recent history (~12 messages)
  → Persist USER message
  → RetrievalService.retrieve (topK ≈ 12, scoped to conversation repo when set)
  → PromptContextBuilder (system + repo meta + chunks + history + question)
  → LLM generate or stream (hosted mock | openai | anthropic | grok | gemini, or workspace BYOK)
  → Persist ASSISTANT message (metadata: sources, model, usage)
```

### SSE stream events

```text
sources → token* → message → done
```

**Stored in PostgreSQL:** `Conversation`, `Message`, `MessageSourceCitation`, optional `AnswerFeedback`  
Chat does not write vectors; it reads Qdrant + PG at ask time.

---

## 6. Living onboarding guides

**Who:** `apps/api/src/modules/onboarding/` + web `apps/web/src/features/onboarding/`

After embed succeeds, the indexing worker queues `onboarding-guide-generation` (`INITIAL_INDEX` or `REINDEX`). Owners, admins, and members can also generate or regenerate from `/repositories/:repositoryId/guides`.

See [Living onboarding guides](./onboarding-guides.md) for types, REST, and UI behavior.

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
| Onboarding guides | `apps/api/src/modules/onboarding/`        |

Related docs: [Architecture](../Architecture.md), [auth and identity](./auth-and-identity.md), [code intelligence](./code-intelligence.md), [retrieval](./retrieval.md), [onboarding guides](./onboarding-guides.md)
