# Phase 1 — AI Onboarding Assistant

This is the original Phase 1 product spec, annotated with **shipped** implementation status. Architect AI’s current MVP is this phase.

Implementation details live in [Architecture](./Architecture.md) and the feature notes under [docs/features](./features/). The longer-term product direction is in [Roadmap](./Roadmap.md).

**Status legend**

- **Done** — acceptance criteria are met.
- **Superseded** — shipped, but richer or different than the original wording.
- **Partial** — present, but narrower than the original acceptance criteria.

## Not in Phase 1

These remain later-phase or placeholder work and must not be read as shipped:

- Architecture Explorer (dashboard widget is a placeholder)
- Decision Memory
- Impact analysis
- GitLab / Bitbucket ingestion
- SSO
- Hybrid/lexical search, model reranking, and knowledge-graph retrieval
- Personal account settings (`/settings` is a placeholder)
- Source-click interaction analytics (citation frequency is recorded; UI clicks are not)

---

## Epic: Repository Setup

### Task: Initialize Monorepo

**Status:** Done

pnpm workspaces and Turborepo with `apps/api`, `apps/web`, and `packages/{shared,ui,ai,code-intelligence}`.

**Original acceptance criteria**

- Backend application created
- Frontend application created
- Shared package structure defined

---

### Task: Configure CI

**Status:** Done

`.github/workflows/ci.yml` runs lint, unit tests, typecheck, API E2E tests, and build on pull requests.

---

### Task: Docker Development Environment

**Status:** Done (extended)

`docker-compose.yml` starts PostgreSQL, Redis, Qdrant, the API, the web app, and a dedicated indexing/onboarding worker.

---

## Epic: Authentication

### Task: Implement Authentication

**Status:** Superseded

Email/password sign-up and sign-in, rotating refresh sessions, and protected routes are implemented. Identity OAuth was added: Google and GitHub sign-in persist `IdentityAccount` rows. GitHub **sign-in** is not the same flow as GitHub **repository connect**.

---

### Task: Create Workspace Model

**Status:** Superseded

Users belong to workspaces with `OWNER` / `ADMIN` / `MEMBER` / `VIEWER` roles. Invitations go beyond the original ownership-only model.

---

### Task: Workspace Switching

**Status:** Done

Active workspace is stored on the access JWT (`activeWorkspaceId`). Repository access is isolated by `workspaceId`.

---

## Epic: GitHub Connectivity

### Task: Implement GitHub OAuth

**Status:** Done

Repository-connect OAuth stores encrypted GitHub tokens on `OAuthAccount` (`TOKEN_ENCRYPTION_KEY`, AES-256-GCM).

---

### Task: Fetch User Repositories

**Status:** Done

Accessible repositories are listed, including private repositories the connected GitHub account can see.

---

### Task: Repository Connection Flow

**Status:** Done

Selecting a repository persists a `Repository` row and enqueues `INITIAL_CONNECT` indexing.

---

### Task: Repository Status Tracking

**Status:** Superseded

Original statuses: Pending, Cloning, Parsing, Embedding, Ready, Failed.

Shipped enum adds **`CHUNKING`**: `PENDING → CLONING → PARSING → CHUNKING → EMBEDDING → READY`, with `FAILED` on terminal retry exhaustion. A repository that already has a successful index stays searchable during rebuild.

---

## Epic: Repository Processing

### Task: Clone Repository

**Status:** Done

Shallow clone of the selected or default branch into `INDEXING_TMP_DIR`.

---

### Task: Repository Cleanup Strategy

**Status:** Done

Temporary clone directories are removed after embed or failure. Clone size and time limits are enforced.

---

### Task: Build Indexing Queue

**Status:** Done

BullMQ queue `repository-indexing` with retries, exponential backoff, and recoverable failed jobs.

---

### Task: Implement ParseRepositoryJob

**Status:** Done

Named as the worker `parse` stage. Supported files are discovered; unsupported, ignored, empty, and unparseable files are skipped.

---

### Task: Implement ChunkRepositoryJob

**Status:** Done

Named as the worker `chunk` stage (`CHUNKING`). One semantic chunk per meaningful symbol, with metadata persisted on `Chunk`.

---

### Task: Implement EmbeddingJob

**Status:** Done

Named as the worker `embed` stage. Batch embeddings are upserted to Qdrant.

---

### Task: Implement ReindexRepositoryJob

**Status:** Done

Manual reindex and retry are supported. A new `IndexingRun` is built alongside the live index; previous Postgres artifacts and Qdrant vectors are deleted only after the new run succeeds.

---

## Epic: Code Understanding

### Task: Integrate Tree-sitter

**Status:** Superseded

Original languages: TypeScript, JavaScript.

Shipped languages: TypeScript, JavaScript, Python, and PHP (including TSX/JSX and PHP/Python module variants).

---

### Task: Extract Symbols

**Status:** Done (extended)

Classes, functions, methods, and interfaces, plus enums, type aliases, variables, constants, namespaces, and modules.

---

### Task: Store Symbol Metadata

**Status:** Done

`CodeSymbol` stores name, type, file path, line numbers, and additional coordinates/modifiers.

---

### Task: Build File Inventory

**Status:** Done

`RepositoryFile` inventory is unique per `(repositoryId, indexingRunId, path)`.

---

## Epic: Retrieval Infrastructure

### Task: Configure Qdrant

**Status:** Done

Collection `architect_chunks` is created automatically. Payload metadata supports tenant and indexing-run filters.

---

### Task: Implement Embedding Provider

**Status:** Done

`EmbeddingProvider` abstraction with OpenAI and deterministic hash/mock adapters.

---

### Task: Store Vector Payload Metadata

**Status:** Done (extended)

Payload includes repository ID, file path, symbol name, and language, plus workspace ID, indexing-run ID, and related file/symbol context.

---

### Task: Implement Semantic Search

**Status:** Done

Top-k cosine search with workspace, repository, and live indexing-run filters.

---

## Epic: Conversational Experience

### Task: Create Conversation Model

**Status:** Done

`Conversation` and `Message`, with optional `repositoryId`. Conversations are workspace-scoped.

---

### Task: Build Retrieval Engine

**Status:** Done

User questions are embedded and retrieved through `RetrievalService`.

---

### Task: Build Context Builder

**Status:** Done

Prompt context includes the question, repository metadata, retrieved sources, and recent conversation history.

---

### Task: Implement LLM Provider Interface

**Status:** Superseded

Original: interface plus Claude.

Shipped `LlmProvider` adapters: mock, OpenAI, Anthropic, Grok, and Gemini. Workspace BYOK can override the hosted generation provider.

---

### Task: Generate Answers

**Status:** Done

Answers include source citations (`MessageSourceCitation`).

---

### Task: Enable Streaming Responses

**Status:** Done

SSE stream: `sources` → `token*` → `message` → `done`.

---

## Epic: User Interface

### Task: Create Dashboard

**Status:** Done

`/dashboard` shows repositories, conversations, guides, usage, and workspace setup. Architecture Explorer and Decision Memory cards are later-phase placeholders.

---

### Task: Repository Setup Flow

**Status:** Done

Repository selection, branch selection, and indexing progress (including `CHUNKING`) are in the repositories UI.

---

### Task: Build Chat Interface

**Status:** Done

`/chat` submits questions, streams answers, and preserves history. A conversation can target one repository or all ready repositories in the workspace.

---

### Task: Display Source References

**Status:** Done

Cited files and paths are shown with answers.

---

### Task: Implement Loading States

**Status:** Done

Indexing statuses and chat loading indicators are visible in the UI.

---

## Epic: Automated Documentation

### Task: Generate Project Overview

**Status:** Superseded

Original sections: project purpose, folder structure, key modules.

Shipped living guide types: `EXECUTIVE_SUMMARY`, `PROJECT_OVERVIEW`, `FOLDER`, `MODULE`, `SERVICE`, `TECHNOLOGY_STACK`, `READING_ORDER`, `GLOSSARY`, `COMMON_PITFALLS`. There is no FAQ type and no writer that commits a README into the repository.

See [Living onboarding guides](./features/onboarding-guides.md).

---

### Task: Generate Service Summaries

**Status:** Done

`SERVICE` guides are generated per ranked service candidate.

---

### Task: Persist Generated Guides

**Status:** Done

Guides are retrievable per workspace/repository. Generation and regeneration are queued; a successful run transactionally replaces the requested types.

---

## Epic: Production Readiness

### Task: Add API Rate Limiting

**Status:** Done

In-process `RateLimitGuard`. Limits are not coordinated across API replicas.

---

### Task: Secure GitHub Tokens

**Status:** Done

GitHub OAuth tokens and BYOK keys are encrypted at rest with AES-256-GCM.

---

### Task: Implement Repository Access Validation

**Status:** Done

Workspace membership authorizes reads. Mutations can perform a live GitHub access check for the acting user.

---

### Task: Add Structured Logging

**Status:** Done

Request and worker logs include user, workspace (organization), and repository IDs when known.

---

### Task: Configure Error Tracking

**Status:** Done

Optional Sentry capture on the API and web app.

---

## Epic: Product Validation

### Task: Admin Panel

**Status:** Done

Separate admin auth and UI: users, plans, usage, logs, and analytics (`/admin/*`).

---

### Task: Track Repository Connections

**Status:** Done

`AnalyticsEvent` records repository connection and indexing outcomes.

---

### Task: Track Questions Asked

**Status:** Done

Admin analytics and `AI_QUESTIONS` usage count user chat messages.

---

### Task: Track Source Usage

**Status:** Partial

Citation frequency is aggregated from `MessageSourceCitation`. The UI does not record source-click or other interaction events.

---

### Task: Collect Answer Feedback

**Status:** Done

Users can rate assistant messages Helpful or Not Helpful (`AnswerFeedback`).

---

## Epic: Project Launch

### Task: Landing Page

**Status:** Done

`/` renders the marketing landing page (authenticated users still see it; they are not redirected away).

---

### Task: Usage Limits & BYOK

**Status:** Superseded

Plan-based usage limits and workspace BYOK are implemented, plus Stripe self-serve checkout, billing portal, period-end downgrade to Free, and resume. Enterprise can be contact-sales only. See [Usage limits, billing, and AI providers](./features/usage-and-ai-providers.md).

---

### Task: Production Deployment

**Status:** Done

Single-host AWS EC2 Docker Compose with Caddy TLS. See [EC2 deployment](./features/deploy-ec2.md).

---

### Task: Project Documentation

**Status:** Done

[README](../README.md), [Architecture](./Architecture.md), [Roadmap](./Roadmap.md), and feature docs describe the shipped MVP.
