# Architect AI MVP Architecture

This document describes the architecture that is implemented in the current MVP. It is intentionally implementation-first: future product phases are listed separately and should not be read as deployed capabilities.

## 1. MVP scope

Architect AI is currently a multi-tenant codebase onboarding application. A user can:

- create an account (email/password or Google/GitHub identity) and a personal workspace;
- invite members and assign workspace roles;
- connect a GitHub account and select a repository and branch;
- index TypeScript, JavaScript, Python, and PHP source asynchronously;
- browse indexed files and symbols;
- ask repository-scoped or workspace-scoped questions and receive source citations;
- generate and browse evidence-backed onboarding guides;
- use hosted AI or a workspace-owned API key for OpenAI, Anthropic, Grok, or Gemini;
- subscribe to a paid plan through Stripe or stay on Free;
- view usage, while platform admins manage limits and inspect analytics and logs.

The MVP does **not** yet implement architecture visualization, decision memory, impact analysis, GitLab or Bitbucket ingestion, repository webhooks, incremental indexing, or a knowledge graph.

## 2. System shape

The runtime is a modular monolith with a separate background worker, not a set of independently deployed microservices.

```text
Browser
   │
   ▼
Next.js web app :3000
   │ HTTPS/REST + SSE
   ▼
NestJS API :5000 ───────────────► PostgreSQL
   │                                  source of truth
   ├──────────────► Redis
   │                sessions, caches, BullMQ
   │
   └──────────────► Qdrant
                    chunk vectors

NestJS indexing worker
   ├── consumes BullMQ jobs from Redis
   ├── clones from GitHub
   ├── parses, chunks, and embeds code
   ├── writes PostgreSQL and Qdrant
   └── generates onboarding guides

External services:
GitHub OAuth/API · Google identity OAuth · OpenAI, Anthropic, Grok, and/or Gemini · Stripe · Resend (optional) · Sentry (optional)
```

Both the HTTP process and worker bootstrap the same NestJS `AppModule`. `INDEXING_WORKER_ENABLED` prevents queue consumers from running in the API process. The worker has no HTTP listener and enables both repository-indexing and onboarding-guide workers.

## 3. Repository layout

```text
apps/
  api/                    NestJS API, Prisma schema, indexing worker
  web/                    Next.js application
packages/
  shared/                 shared workspace utilities
  ui/                     shared UI package
  ai/                     early standalone AI package; not the API runtime abstraction
  code-intelligence/      package boundary placeholder; production logic is in apps/api
docs/
  Architecture.md
  Roadmap.md
  features/               feature-level implementation notes
infrastructure/
  docker/                 development and production images
  caddy/                  production reverse proxy/TLS
```

The repository is a pnpm workspace orchestrated by Turborepo. The active code-intelligence, retrieval, and LLM modules live under `apps/api/src/modules/`; the similarly named workspace packages are not the main execution path.

## 4. Application boundaries

### 4.1 Web application

`apps/web` is a Next.js 16 / React 19 / TypeScript application using the App Router, TanStack Query, Axios, React Hook Form, Tailwind CSS, and Radix-based components.

Implemented user surfaces include:

- landing (including contact form), sign-up, and sign-in (email/password plus Google and GitHub identity OAuth);
- password reset (`/forgot-password`, `/reset-password/:token`) and profile name updates (`/profile`);
- dashboard and workspace switching;
- repository connection (OAuth list or public GitHub URL), status, file, and symbol browsing;
- streaming repository chat, conversation history, citations, and feedback;
- onboarding guide library and guide detail views;
- workspace settings, members (including role updates), invitations (including resend), usage, billing, and AI provider keys;
- separate platform-admin authentication, analytics, users, plans, and logs.

Personal `/settings` remains a placeholder. Decision Memory appears on the dashboard as a later-phase placeholder. Architecture Explorer ships Dependency Mapping and Architecture Search.

The browser sends access tokens as bearer tokens. Refresh tokens are rotated by the API and stored in an HTTP-only cookie. Next.js middleware uses a lightweight access-token cookie to route users; API guards remain the authorization boundary.

### 4.2 API application

`apps/api` is a NestJS 11 modular monolith. Its main modules are:

- `auth`, `users`, `workspaces`, `memberships`, and `invitations`;
- `integrations/github` and `repositories`;
- `modules/code-intelligence`, `modules/retrieval`, and `modules/llm`;
- `conversations` and `chat`;
- `modules/onboarding`;
- `workspace-ai`, `usage`, `billing`, `analytics`, `system-logs`, and `admin`.

Controllers expose REST endpoints; chat additionally exposes Server-Sent Events (SSE). Swagger is available at `/docs` outside production, and `/health` is the container health endpoint.

Global API behavior includes DTO validation, CORS with credentials, request IDs, structured HTTP logging, persisted system logs, exception normalization, optional Sentry capture, and an in-process rate-limit guard.

### 4.3 Background worker

`apps/api/src/indexing-worker.ts` starts a NestJS application context. It consumes two BullMQ queues:

- `repository-indexing` for clone, parse, chunk, and embed stages;
- `onboarding-guide-generation` for post-index or manually requested guides.

Jobs use retries and exponential backoff. Repository status and run records make progress and failures visible to the UI. The API only enqueues jobs; repository indexing is not performed in an HTTP request.

## 5. Core flows

### 5.1 Authentication and workspace authorization

```text
Sign up / sign in (email-password or Google/GitHub identity OAuth)
  → bcrypt password verification, or IdentityAccount link
  → access JWT + rotating refresh JWT
  → refresh session stored in Redis
  → active workspace encoded in access token
  → workspace and role guards authorize each request
```

Email/password accounts store a password hash. Google and GitHub **identity** sign-in create or link an `IdentityAccount` and do not grant GitHub repository access. GitHub **repository connect** is a separate OAuth flow that stores encrypted tokens on `OAuthAccount`.

Sign-up creates a personal `FREE` workspace and `OWNER` membership. Roles are `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER`. Workspace-scoped endpoints verify both active membership and route workspace. Mutating operations add role checks.

Redis is the normal refresh-session store. A process-local in-memory fallback exists for development when Redis is not configured; it is not suitable for multiple API replicas.

Platform admins use separate credentials, JWT secrets, routes, and UI state from workspace users.

### 5.2 GitHub connection and repository ingestion

```text
User requests connect URL
  → signed OAuth state (user + optional workspace)
  → GitHub consent and callback
  → encrypted OAuth tokens stored in PostgreSQL
  → list or resolve repositories and branches
  → create Repository row
  → enqueue INITIAL_CONNECT indexing
```

GitHub OAuth credentials belong to a user, while connected repositories belong to a workspace. Members can list remotes the connected account can see or resolve a public GitHub URL / `owner/repo` via `GET /integrations/github/resolve`. OAuth tokens and workspace BYOK provider keys are encrypted with AES-256-GCM via `TOKEN_ENCRYPTION_KEY`.

Repository mutation and reindex operations can perform a live GitHub access check for the acting user. Reading already-indexed workspace content is authorized by workspace membership rather than every member having direct GitHub access.

The current schema has a global unique constraint on `(provider, externalId)`, so the same provider repository cannot be connected to multiple workspaces. This is an MVP constraint, not the intended long-term tenancy model.

### 5.3 Repository indexing

```text
Connect / retry / reindex
  → reindex job creates a new IndexingRun alongside the live index
  → shallow authenticated git clone
  → Tree-sitter parse
  → semantic symbol chunks
  → batch embeddings
  → Qdrant upsert tagged with the new run id
  → repository READY
  → delete previous generation's Postgres artifacts and Qdrant vectors
  → enqueue onboarding-guide generation
```

State transitions:

```text
PENDING → CLONING → PARSING → CHUNKING → EMBEDDING → READY
     └──────────────── any terminal retry exhaustion ───────► FAILED
```

A repository that already has a successful index stays searchable during rebuild. Chat, file browse, and symbol browse pin to the latest `SUCCEEDED` `IndexingRun`. Progress still moves through `CLONING` / `PARSING` / `CHUNKING` / `EMBEDDING`. If the new run fails, status returns to `READY` and `indexingError` records the refresh failure. First-time connect/retry failures still end in `FAILED`.

The stages are chained BullMQ jobs rather than one long job:

1. **Reindex** creates an `IndexingRun`, sets repository status to `CLONING`, and enqueues clone. It does not delete the live index.
2. **Clone** performs a shallow clone of the selected/default branch into `INDEXING_TMP_DIR` and records branch and commit SHA.
3. **Parse** scans supported files, persists inventory for the current run, extracts symbols and static relationships, and prunes unseen files in that run only.
4. **Chunk** creates one source-backed semantic chunk per meaningful symbol.
5. **Embed** batches chunks through the configured embedding provider, upserts vectors, marks the run successful and repository `READY`, then deletes the previous generation, cleans temporary files, and enqueues living-guide generation.

### 5.4 Code intelligence

The code-intelligence module is independent of chat and LLM generation:

```text
Recursive scanner
  → language-pack detection (and non-parsed manifests)
  → Tree-sitter AST adapter
  → pack symbol extraction
  → pack static relationship extraction
  → PostgreSQL persistence
  → semantic chunk construction
```

Current language support is TypeScript, JavaScript, Python, and PHP (including TSX/JSX and PHP/Python module variants). Languages are registered as packs under `apps/api/src/modules/code-intelligence/languages/`. Ignored build/dependency directories, binaries, unsupported files, empty files, and unparseable files are skipped. Manifests such as `package.json`, `composer.json`, and `pyproject.toml` are inventoried without parsing.

Extracted symbols include functions, classes, methods, interfaces, enums, type aliases, variables, constants, namespaces, and modules. Relations include imports, exports, extends, implements, calls, and uses. This is static, syntax-level analysis; it is not a complete runtime call graph.

### 5.5 Retrieval and chat

Index path:

```text
PostgreSQL Chunk rows
  → EmbeddingProvider.embedBatch
  → QdrantVectorStore.upsert
  → Chunk.vectorId + embeddingModel
```

Question path:

```text
Question
  → query embedding
  → Qdrant cosine search with workspace, repository, and live indexing-run filters
  → similarity ranking with lightweight code-hint bonuses
  → hydrate chunks, files, and symbols from PostgreSQL
  → deduplicate and assemble RetrievedContext
  → build prompt with recent conversation history
  → LLM generate/stream
  → persist messages and source citations
```

Chat loads approximately 12 recent messages and retrieves approximately 12 chunks. A conversation can target one repository or search ready repositories in the active workspace. Streaming emits `sources`, zero or more `token` events, the persisted `message`, and `done`.

The retrieval boundary exposes provider-neutral `EmbeddingProvider`, `VectorStore`, cache, and chunk-data-source contracts. Current implementations are:

- deterministic hash embeddings for local development and tests;
- OpenAI embeddings for real semantic retrieval;
- Qdrant as the only vector-store adapter;
- Redis retrieval cache with an in-memory option.

Current ranking combines vector similarity with lightweight query/code-hint bonuses. Hybrid lexical search, reranking models, intent detection, and graph retrieval are not implemented.

### 5.6 LLM providers and BYOK

Chat and onboarding guides consume a shared `LlmProvider` contract, built by a single `buildLlmProvider` factory shared between the hosted provider and BYOK resolution. The hosted provider is selected with `LLM_PROVIDER`:

- `mock` for deterministic local development;
- `openai`;
- `anthropic`;
- `grok`;
- `gemini`.

A workspace owner or admin can save an API key per provider (OpenAI, Anthropic, Grok, or Gemini) and mark one as the workspace's active provider. When a provider is active, `WorkspaceLlmResolver` builds a workspace-specific provider instance from the decrypted key for generation; otherwise it falls back to the hosted provider. Switching the active provider takes effect immediately and does not require re-entering a key. BYOK affects LLM generation only; embeddings remain platform-configured.

Mock embeddings and the mock LLM exercise the complete application flow but do not provide production-quality semantic answers or guides.

### 5.7 Living onboarding guides

After a successful index, guide generation is queued without changing the repository back from `READY`. It can also be initiated manually.

```text
READY repository
  → load latest indexed topology
  → discover deterministic guide targets
  → retrieve focused evidence per target
  → generate evidence-constrained Markdown
  → normalize required sections
  → transactionally replace requested guide types
```

Implemented guide types are executive summary, project overview, folder, module, service, technology stack, reading order, glossary, and common pitfalls.

Generation writes a new guide set only after all requested targets succeed. Existing guides remain readable during regeneration and survive a failed run. `generationVersion` is a revision counter; immutable guide history is not stored.

## 6. Persistence model

### PostgreSQL: system of record

Prisma manages relational data in these main groups:

- identity: `User`, `Admin`, `IdentityAccount`, `OAuthAccount`;
- tenancy: `Workspace`, `Membership`, `Invitation`;
- commercial controls: `Plan`, `PlanPrice`, `PlanLimit`, `WorkspaceSubscription`, `WorkspaceAiSettings`;
- repositories: `Repository`, `IndexingRun`;
- code knowledge: `RepositoryFile`, `CodeSymbol`, `SymbolRelation`, `Chunk`;
- generated knowledge: `Guide`, `GuideGenerationRun`;
- conversations: `Conversation`, `Message`, `MessageSourceCitation`, `AnswerFeedback`;
- operations and product data: `AnalyticsEvent`, `SystemLog`, `StripeWebhookEvent`.

Workspace IDs are carried through repository, conversation, guide, usage, and citation queries. Qdrant payloads repeat workspace and repository IDs so vector searches can enforce tenant filters.

### Qdrant: derived vector index

The shared collection defaults to `architect_chunks`. A point ID is the PostgreSQL chunk ID. Payloads include workspace, repository, indexing run, file, symbol, language, branch, and commit-related context. Qdrant is rebuildable derived state; PostgreSQL owns chunk content and metadata. Search filters by the latest successful indexing run so a rebuild cannot mix generations.

### Redis: ephemeral coordination

Redis is used for:

- BullMQ queues and worker coordination;
- rotating refresh-token sessions;
- retrieval query/context caches.

Redis is not the source of truth for users, repositories, indexed code, messages, or guides.

## 7. Usage and administration

Plan limits are database rows keyed by workspace plan and metric. The MVP enforces:

- current repositories;
- monthly indexing runs;
- monthly guide-generation runs;
- monthly AI questions;
- current active members (pending invitations do not consume a seat until accepted);

New workspaces are `FREE`. Paid plans (`PRO` and others configured by admins) have monthly Stripe prices for STANDARD and BYOK billing modes. Owners and admins upgrade through Stripe Checkout, manage payment methods in the Stripe billing portal, and can schedule a period-end downgrade to Free or resume that cancellation. Plans marked `isContactSales` (typically Enterprise) skip checkout and point to sales. Having an active BYOK provider removes question and guide limits but does not remove repository, indexing, or member limits, and does not change the Stripe plan price.

Platform-admin endpoints and pages expose workspace usage, user management, editable plan limits and prices, product analytics, and persisted system logs.

## 8. Security and isolation

Implemented controls include:

- bcrypt password hashes;
- short-lived access JWTs and rotating refresh JWTs;
- HTTP-only refresh cookies;
- workspace membership and role guards;
- separate admin authentication secrets;
- signed GitHub and identity OAuth state;
- encrypted OAuth and BYOK secrets at rest;
- repository/workspace filters in PostgreSQL and Qdrant;
- DTO allow-list validation;
- configurable CORS;
- request IDs, audit/system logs, and optional Sentry;
- production startup validation for critical secrets, including Stripe keys.

Known MVP constraints:

- the rate limiter is process-local, so limits are not coordinated across API replicas;
- refresh-session memory fallback is process-local;
- access tokens are also mirrored to a client-readable cookie/local state for the current web routing design;
- Qdrant isolation depends on every query applying the correct payload filters;
- there is no SSO, SCIM, enterprise policy engine, or audit-log export.

## 9. Deployment

### Local development

`docker-compose.yml` starts:

- Next.js web;
- NestJS API;
- dedicated indexing/onboarding worker;
- PostgreSQL 16;
- Redis 7;
- Qdrant.

Development containers bind-mount the repository and run framework watch modes. The API container applies committed Prisma migrations.

### Production

`docker-compose.prod.yml` is the implemented production target for a single VM (Hostinger VPS, AWS EC2, or similar):

- multi-stage, non-root application images;
- separate API and worker processes;
- PostgreSQL, Redis, and Qdrant on the internal Compose network;
- Caddy for TLS and reverse proxying;
- persistent named volumes;
- health checks, restart policies, memory limits, and log rotation;
- API-start migration deployment.

This is a single-host architecture. It does not provide multi-node database failover, distributed rate limiting, autoscaling, or Kubernetes orchestration.

## 10. Observability and testing

The API emits structured request and worker logs with request, workspace, repository, status, and latency context. HTTP and audit events are persisted in PostgreSQL; Sentry is optional. Retrieval maintains in-process metrics for search, embeddings, ranking, cache behavior, and retrieved chunk counts, but no Prometheus endpoint is currently wired.

The monorepo uses Jest for API unit/E2E tests and Vitest for web tests. Pull-request CI runs:

```text
lint → unit tests → typecheck → API E2E tests → build
```

## 11. Architectural decisions and trade-offs

1. **Modular monolith first.** Domain modules keep boundaries explicit without the operational cost of MVP microservices.
2. **Worker isolation.** Clone and AI-heavy work cannot block API requests and can be scaled separately.
3. **PostgreSQL as source of truth.** Relational identity, tenancy, provenance, and static-code relations remain queryable and transactional.
4. **Qdrant as derived state.** Semantic search scales independently while vectors remain rebuildable.
5. **Retrieval before generation.** Chat and guide generation consume a provider-neutral retrieved context instead of querying Qdrant directly.
6. **Provider adapters.** LLM and embedding vendors are selected at composition boundaries, although Qdrant is currently the only vector backend.
7. **Evidence over autonomous action.** The MVP explains indexed code with references; it does not modify repositories.
8. **Single-host operations.** Docker Compose and Caddy are appropriate for validation, with known limits before horizontal scaling.

## 12. Evolution path

The next architecture work should extend the current boundaries rather than claim already-planned systems:

1. add incremental indexing and GitHub webhook-triggered refresh;
2. add more language packs (Go, Java, Rust) and improve relationship resolution;
3. add lexical/hybrid retrieval, reranking, and retrieval evaluation;
4. remove the global repository/workspace uniqueness constraint;
5. move rate limiting and all session behavior to shared infrastructure;
6. add durable guide revisions and richer repository provenance;
7. build architecture exploration on `CodeSymbol` and `SymbolRelation`;
8. add decision sources and impact analysis only after their data models are implemented.

Detailed implementation notes:

- [Documentation index](README.md)
- [Main app flow](features/main-app-flow.md)
- [Auth and identity](features/auth-and-identity.md)
- [Code intelligence](features/code-intelligence.md)
- [Retrieval](features/retrieval.md)
- [Living onboarding guides](features/onboarding-guides.md)
- [Usage limits, billing, and AI providers](features/usage-and-ai-providers.md)
- [Hostinger / VPS deployment](features/deploy-hostinger.md)
- [EC2 deployment](features/deploy-ec2.md)
- [Product roadmap](Roadmap.md)
