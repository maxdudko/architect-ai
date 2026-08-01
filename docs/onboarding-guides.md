# Living Onboarding Guides

Living Onboarding Guides turn a successfully indexed repository into a structured, workspace-scoped guide library. They are "living" because a successful initial index or reindex queues a fresh generation run, while users can also generate or regenerate guides manually.

## Product Boundary

The feature consumes repository knowledge; it does not extract source knowledge itself.

- **Knowledge extraction** belongs to indexing, Code Intelligence, and Retrieval. Those systems clone and parse the repository, persist files, symbols, relations, and chunks, and create searchable vectors.
- **Guide generation** reads the latest successful indexed topology and focused retrieval results, asks the configured LLM provider for evidence-constrained Markdown, normalizes the output, and persists the current guide set.
- Guides are generated explanations, not a new source of truth. Prompts require repository-relative evidence paths, distinguish verified facts from inference, and treat retrieved code as untrusted evidence rather than instructions.
- Generation requires the repository to be `READY`. It does not clone, parse, chunk, embed, or mutate repository indexing data.

## Module and Package Layout

### API

`apps/api/src/modules/onboarding/`

- `onboarding.module.ts` — NestJS composition and provider bindings
- `onboarding-guides.controller.ts` / `onboarding-guides.service.ts` — workspace-scoped HTTP boundary and queue handoff
- `onboarding-guide.orchestrator.ts` — run lifecycle, target ordering, generation, and atomic guide-set replacement
- `generators/` — registry, one generator per guide type, and the shared retrieval-backed generator
- `guides/` — latest-index data source and deterministic topology analysis
- `prompts/` / `templates/` — evidence context, prompt construction, and required section contracts
- `queue/` — BullMQ producer, worker, names, and runtime configuration
- `storage/` — Prisma adapter for guides and generation runs
- `interfaces/`, `types/`, `dto/`, `utils/` — ports, domain shapes, transport contracts, slugs, summaries, and Markdown normalization

The indexing worker calls `OnboardingGuideQueueService` after a successful embed stage. `OnboardingModule` is exported through the repository/application module graph so manual and automatic generation use the same queue and orchestrator.

### Web

- `apps/web/src/app/(app)/repositories/[repositoryId]/guides/` — library and guide detail routes
- `apps/web/src/features/onboarding/` — guide view, Markdown renderer, query hooks, tree grouping, and heading/TOC utilities
- `apps/web/src/lib/api/onboarding-guide.ts` — REST client
- `apps/web/src/entities/onboarding-guide.ts` — guide and run response types

## Data Model

The migration creates `guides` and `guide_generation_runs`.

### `Guide`

A guide belongs to both a workspace and repository and is uniquely identified by `(repositoryId, type, slug)`. It stores:

- `type`, stable `slug`, `title`, generated `markdown`, and optional plain-text `summary`
- JSON `metadata`, including target identity/path, evidence paths, retrieval query, provider, and model
- `generationVersion`, starting at 1 and incremented when the same type/slug is replaced
- optional `sourceIndexingRunId` and `sourceCommitSha` provenance
- creation and update timestamps

Replacement is transactional and scoped to the requested types. Generated identities are upserted, obsolete guides of those types are deleted, and unrequested types remain unchanged.

### `GuideGenerationRun`

A run records:

- trigger: `INITIAL_INDEX`, `MANUAL_GENERATE`, `MANUAL_REGENERATE`, or `REINDEX`
- status: `QUEUED`, `RUNNING`, `SUCCEEDED`, or `FAILED`
- requested types and total/completed target counts
- source indexing run and commit provenance when known
- top-level error, structured errors, and lifecycle timestamps

Only one active (`QUEUED` or `RUNNING`) run is reused per workspace/repository by the application-level enqueue path. The database does not enforce this with a partial unique index.

## Generation Sequence and Guide Types

```text
READY repository
  → create QUEUED generation run
  → BullMQ worker marks RUNNING
  → load latest successful indexed topology
  → discover singleton and topology-derived targets
  → retrieve focused evidence for each target
  → build constrained prompt and call LlmProvider
  → normalize Markdown and collect compact summaries
  → transactionally replace requested guide types
  → mark SUCCEEDED
```

Generation is sequential. Non-synthesis guides run first; `READING_ORDER`, `GLOSSARY`, and `COMMON_PITFALLS` run last so their prompts can use compact summaries of previously generated guides. If any target fails, the run fails before replacement, preserving the previous persisted guide set.

| Type                | Cardinality                      | Purpose                                                           |
| ------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `EXECUTIVE_SUMMARY` | One                              | Decision-oriented purpose, boundaries, flows, risks, and unknowns |
| `PROJECT_OVERVIEW`  | One                              | Architecture, core flows, and starting points for engineers       |
| `FOLDER`            | One                              | Consolidated conceptual map of major folders                      |
| `MODULE`            | One per ranked module candidate  | Responsibilities, components, dependencies, and change boundary   |
| `SERVICE`           | One per ranked service candidate | Inputs, outputs, collaborators, operations, and hazards           |
| `TECHNOLOGY_STACK`  | One                              | Evidence-backed runtimes, frameworks, data, and tooling           |
| `READING_ORDER`     | One                              | Progressive and role-based reading path                           |
| `GLOSSARY`          | One                              | Repository-specific domain and architecture vocabulary            |
| `COMMON_PITFALLS`   | One                              | Coupling, assumptions, risky changes, and a safe-change checklist |

Omitting `types` requests every type. A non-empty subset supports targeted generation or regeneration.

## Topology and Retrieval Strategy

Topology is deterministic metadata derived from the latest successful `IndexingRun` and its non-ignored, non-binary, non-generated files, symbols, and relations:

- repository scale and relation-density metrics
- ranked two-level folder boundaries
- module candidates from cohesive folders, boosted by explicit module symbols
- service candidates from symbols ending in names such as `Service`, `Controller`, `Repository`, `Worker`, or `Handler`
- conventional entry-point filenames
- language counts and manifest/configuration markers for technology evidence

For each target, the generator issues a focused, repository-scoped retrieval query with `topK: 14`. The prompt combines compact topology metadata, focused hydrated chunks/references, the template's required H2 sections, and up to 24 prior guide summaries. Output is limited to Markdown, low-temperature generation, and 2,500 tokens. Normalization restores the expected title and section order and inserts an explicit unknown marker when evidence is missing.

This hybrid strategy uses topology for stable target discovery and vector retrieval for detailed evidence. PostgreSQL remains the source of truth for indexed structure and guide content; Qdrant supplies semantic retrieval context.

## Provider Neutrality

Onboarding code depends on the shared `LlmProvider` port and `RetrievalService`, not a provider SDK. The existing LLM module selects `mock`, `openai`, or `anthropic` through `LLM_PROVIDER` (default `mock`). Shared output configuration uses `LLM_MAX_TOKENS`; provider settings use `LLM_MOCK_MODEL`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_API_BASE_URL`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`. Embedding and vector-store selection remain owned by Retrieval.

Provider and model are recorded in each guide's metadata for operational traceability. Adding another LLM provider should require an LLM adapter and module binding, not changes to guide generators.

## BullMQ and Runtime Configuration

The queue is `onboarding-guide-generation`; jobs are named `generate-onboarding-guides`.

- `REDIS_URL` — required to create the queue. Without it, the producer logs that generation is disabled and manual generation returns service unavailable.
- `ONBOARDING_QUEUE_READY_TIMEOUT_MS` — Redis readiness timeout; defaults to `5000`.
- `ONBOARDING_WORKER_ENABLED` — explicitly enables/disables the guide worker. If unset, it inherits `INDEXING_WORKER_ENABLED`; the final default is `false`.
- `ONBOARDING_WORKER_CONCURRENCY` — worker concurrency; defaults to `1` and is clamped to at least 1.
- `ONBOARDING_JOB_LOCK_DURATION_MS` — lock duration; defaults to 30 minutes. The stalled check interval is half the lock duration, capped at 60 seconds.

Jobs use three attempts with exponential backoff beginning at two seconds. Up to 1,000 completed jobs are retained; failed jobs are retained. A deterministic job id based on the generation-run id prevents duplicate queue entries for the same run.

The worker validates job names, executes the orchestrator, logs queue/worker failures, and records terminal retry exhaustion on the generation run. Long-running deployments must ensure at least one process has the onboarding worker enabled.

## Automatic Post-Index Regeneration

After the embed stage succeeds, indexing first marks the repository `READY`, clears its indexing error, updates `lastIndexedAt`, and cleans the run directory. It then queues guide generation:

- `INITIAL_CONNECT` maps to `INITIAL_INDEX`
- retry or manual reindex paths map to `REINDEX`
- the successful indexing-run id and commit SHA are attached to the guide run and resulting guide provenance

This handoff is deliberately failure-isolated. A missing/unavailable Redis queue, run creation error, or enqueue error is logged, but does not roll back successful indexing or change the repository from `READY`. If another guide run is already active, it is reused rather than enqueueing a competing run.

During regeneration, the previous guides remain readable. New content becomes visible only after the complete requested set is generated and transactionally replaced. A failed generation run therefore leaves the previous set intact; the UI may identify it as stale when `Repository.lastIndexedAt` is newer than a guide's `updatedAt`.

## REST API, Roles, and Polling

All endpoints are JWT-protected and scoped by both `workspaceId` and `repositoryId`:

| Method | Endpoint                                                                   | Roles                        | Behavior                                          |
| ------ | -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| `GET`  | `/workspaces/:id/repositories/:repositoryId/guides`                        | Owner, Admin, Member, Viewer | List guides; optional `type` and text-search `q`  |
| `GET`  | `/workspaces/:id/repositories/:repositoryId/guides/generation-runs/latest` | Owner, Admin, Member, Viewer | Return the latest run or `null`                   |
| `GET`  | `/workspaces/:id/repositories/:repositoryId/guides/:guideId`               | Owner, Admin, Member, Viewer | Get one workspace/repository-scoped guide         |
| `POST` | `/workspaces/:id/repositories/:repositoryId/guides/generate`               | Owner, Admin, Member         | Queue generation; optional `{ "types": [...] }`   |
| `POST` | `/workspaces/:id/repositories/:repositoryId/guides/regenerate`             | Owner, Admin, Member         | Queue regeneration; optional `{ "types": [...] }` |

Generation endpoints return `202 Accepted`. A non-`READY` repository returns a conflict; an unavailable queue returns service unavailable; an existing active run is returned idempotently.

The web client polls the latest run every 2.5 seconds while it is `QUEUED` or `RUNNING`, does not poll in a background tab, and stops after 15 minutes based on run age. A transition to `SUCCEEDED` invalidates the repository's guide queries.

## UI Behavior

Routes:

- `/repositories/:repositoryId/guides` — opens the guide library and selects the first guide in tree order
- `/repositories/:repositoryId/guides/:guideId` — opens a specific guide

The library groups guides as **Overview**, **Folders**, **Modules**, **Services**, and **Knowledge**. The detail view shows type, generation version, summary, regeneration and "Ask AI" actions, generation progress, failure retry when a regeneration fails while prior guides remain, and a stale-content warning.

Markdown is rendered with `react-markdown` and GitHub-Flavored Markdown. Raw HTML is not enabled, so generated HTML is not executed. External HTTP(S) links open in a new tab with `rel="noreferrer"`. Custom renderers constrain typography and horizontally scroll code blocks and tables.

The table of contents extracts H2-H4 headings outside fenced code blocks. The extractor and renderer share stable, duplicate-aware Unicode slugs, so TOC links match rendered heading ids.

The view has explicit states for no active workspace, loading, missing repository, repository not ready, list/detail errors, active generation with or without prior guides, initial empty state, failed initial generation with retry, missing guide, stale content, and successful content.

## Testing and Operations

API unit tests cover topology discovery, prompt/output contracts, generators, orchestration and failure behavior, controller/service authorization boundaries, queue-facing behavior, and transactional Prisma storage. Web tests cover API calls, polling/query invalidation, guide-tree ordering, and heading/slug behavior.

Run the relevant suites from the repository root:

```bash
pnpm --filter api test -- onboarding
pnpm --filter web test -- onboarding
pnpm --filter api typecheck
pnpm --filter web typecheck
```

Generate Prisma Client and apply the migration in development:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:dev
```

Apply committed migrations in deployment:

```bash
pnpm --filter api prisma:migrate:deploy
```

Operational checks:

1. Confirm PostgreSQL, Qdrant, and Redis are reachable.
2. Confirm indexing and retrieval have produced a successful run and searchable chunks.
3. Configure the chosen LLM provider and credentials.
4. Enable at least one onboarding worker process.
5. Poll the latest generation run and inspect retained BullMQ failures and structured run errors when generation does not complete.

## Future: Incremental Generation and Version History

The current implementation regenerates every target for the requested types and stores only the latest content. `generationVersion` is an in-place revision counter, not a history table.

A future incremental design can compare indexing-run provenance, target keys, evidence paths/checksums, and dependency summaries to regenerate only affected module/service guides and dependent synthesis guides. Durable history would require immutable guide revisions (content, metadata, source run/commit, provider/model, and timestamps) plus a pointer to the current revision. That model would support diffs, rollback, auditability, and retention policies without changing the workspace-scoped guide identity.
