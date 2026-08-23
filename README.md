# Architect AI

> The collective engineering memory for software teams.

Architect AI is an open-source MVP for onboarding developers into unfamiliar codebases. It connects to GitHub, indexes source code, and provides repository chat and generated onboarding guides backed by file and line references.

This repository currently implements the **AI Onboarding Assistant** phase. Architecture exploration, decision memory, and impact analysis remain roadmap items.

## What works today

- Email/password authentication with rotating refresh sessions
- Multi-workspace membership, roles, invitations, and workspace switching
- GitHub OAuth, repository discovery, branch selection, and encrypted tokens
- Asynchronous repository indexing with BullMQ and a dedicated worker
- Tree-sitter parsing for TypeScript and JavaScript
- File, symbol, static-relation, and semantic-chunk persistence
- OpenAI or deterministic local embeddings with Qdrant vector search
- Repository-scoped and workspace-scoped chat with SSE streaming
- Persisted conversations, source citations, and answer feedback
- Generated onboarding guides for overviews, folders, modules, services, stack, reading order, glossary, and pitfalls
- Mock, OpenAI, Anthropic, Grok, and Gemini LLM adapters
- Model-agnostic workspace BYOK (OpenAI, Anthropic, Grok, or Gemini) for chat and guide generation, with instant provider switching
- Plan-based usage limits plus admin analytics and system logs
- Development and single-host production Docker Compose stacks

Not implemented yet:

- GitLab and Bitbucket ingestion
- GitHub webhooks or incremental indexing
- Languages other than TypeScript/JavaScript
- Hybrid/lexical search, model reranking, or knowledge-graph retrieval
- Architecture diagrams/explorer
- ADR and decision-memory ingestion
- Change-impact analysis
- Billing, SSO, or multi-node production orchestration

See [MVP Architecture](docs/Architecture.md) for the current system and its trade-offs, and [Roadmap](docs/Roadmap.md) for the longer-term product direction.

## Architecture at a glance

```text
GitHub
   │
   ▼
NestJS API ──enqueue──► Redis / BullMQ ──consume──► Indexing worker
   │                                                      │
   │                                                      ├─ clone
   │                                                      ├─ parse
   │                                                      ├─ chunk
   │                                                      ├─ embed
   │                                                      └─ generate guides
   │
   ├────────► PostgreSQL (identity, tenancy, code metadata, chat, guides)
   ├────────► Qdrant (chunk vectors)
   └────────► OpenAI / Anthropic / Grok / Gemini / mock providers
   ▲
   │ REST + SSE
Next.js web app
```

The MVP is a pnpm/Turborepo monorepo:

```text
apps/
  api/                  NestJS API, Prisma, and background worker
  web/                  Next.js application
packages/
  shared/
  ui/
  ai/
  code-intelligence/
docs/
  Architecture.md
  Roadmap.md
  features/
infrastructure/
  docker/
  caddy/
```

Core technology:

- Next.js 16, React 19, TypeScript, Tailwind CSS
- NestJS 11, Prisma, PostgreSQL 16
- BullMQ and Redis 7
- Tree-sitter for TypeScript/JavaScript analysis
- Qdrant for vector search
- OpenAI, Anthropic, Grok, and Gemini provider adapters

## Quick start with Docker

### Requirements

- Docker with Compose support
- A GitHub OAuth App to connect repositories

Node.js and pnpm are only required when running apps on the host.

### 1. Configure the environment

```bash
git clone <repository-url>
cd architect-ai
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

The root file supplies Docker Compose values; `apps/api/.env` is loaded by the NestJS API and worker. Before connecting GitHub, set the same real credentials in both files:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
TOKEN_ENCRYPTION_KEY=replace-with-a-random-secret-at-least-32-bytes
GITHUB_OAUTH_STATE_SECRET=replace-with-a-strong-random-secret
```

Create the GitHub OAuth App with:

- Homepage URL: `http://localhost:3000`
- Authorization callback URLs:
  - `http://localhost:5000/integrations/github/callback` (repository connect)
  - `http://localhost:5000/auth/oauth/github/callback` (sign-in / sign-up)

Create a Google Cloud OAuth client (Web application) with:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:5000/auth/oauth/google/callback`

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` are optional and fall back to the repo-connect GitHub app credentials.

The default `mock` LLM and embedding providers let the full flow run without AI credentials. They are for development and smoke testing, not useful semantic answers.

For real retrieval and answers, a typical OpenAI-only configuration is:

```bash
EMBEDDING_PROVIDER=openai
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
```

Anthropic, Grok, or Gemini can be used for generation while OpenAI supplies embeddings:

```bash
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-key
# or LLM_PROVIDER=grok / GROK_API_KEY=...
# or LLM_PROVIDER=gemini / GEMINI_API_KEY=...
```

Architect AI is model-agnostic: a workspace owner or admin can save a key for OpenAI, Anthropic, Grok, or Gemini under workspace AI settings and switch the active provider at any time. BYOK replaces only the generation provider for that workspace; embeddings still use the server's `EMBEDDING_PROVIDER`.

### 2. Start the stack

```bash
docker compose up -d --build
```

This starts:

- Web: <http://localhost:3000>
- API: <http://localhost:5000>
- Swagger (development): <http://localhost:5000/docs>
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- Qdrant HTTP: `localhost:6335`
- a dedicated indexing/onboarding worker

The API container applies committed Prisma migrations automatically. Create an account in the web app; sign-up creates a personal Free workspace.

Follow service health and worker activity with:

```bash
docker compose ps
docker compose logs -f api indexing-worker web
```

### 3. Use the MVP

1. Sign up or sign in.
2. Connect your GitHub account from the repository flow.
3. Select a repository and branch.
4. Wait for `PENDING → CLONING → PARSING → CHUNKING → EMBEDDING → READY`.
5. Browse indexed files and symbols.
6. Ask questions from Chat and inspect source citations.
7. Open the repository's Guides section. Initial guide generation is queued after indexing; it can also be run manually.

If indexing ends in `FAILED`, the repository page exposes retry/reindex actions and the stored error.

## Run applications on the host

### Requirements

- Node.js 20+
- pnpm 10.11.1 (the pinned package-manager version)
- Docker Compose for PostgreSQL, Redis, and Qdrant
- `git` available to the worker

Install and configure:

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres redis qdrant
pnpm --filter api prisma:migrate:deploy
```

The API reads `apps/api/.env`. The web app defaults to `http://localhost:5000`; create `apps/web/.env.local` if the API uses another URL:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Run the web and API watch processes:

```bash
pnpm dev
```

Run the background worker in a second terminal:

```bash
pnpm --filter api dev:worker
```

The worker is required for indexing and onboarding-guide generation. `pnpm dev` alone starts only the web and HTTP API workspace tasks.

## Configuration

The checked-in examples are:

- `.env.example` for the Docker development stack
- `apps/api/.env.example` for a host-run API/worker
- `.env.production.example` for the production Compose stack

Important configuration groups:

- data: `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `QDRANT_COLLECTION`;
- authentication: `JWT_*`, `TOKEN_ENCRYPTION_KEY`, cookie and CORS values;
- GitHub: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI`, `GITHUB_OAUTH_STATE_SECRET`;
- identity OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `AUTH_GITHUB_OAUTH_REDIRECT_URI` (optional `AUTH_GITHUB_CLIENT_*` fall back to the GitHub integration app);
- indexing: `INDEXING_WORKER_*`, `INDEXING_TMP_*`, clone size/time limits;
- retrieval: `EMBEDDING_PROVIDER`, embedding model/dimensions/batch size, retrieval cache variables;
- generation: `LLM_PROVIDER`, OpenAI/Anthropic/Grok/Gemini keys and models, `LLM_MAX_TOKENS`;
- operations: rate-limit values, Sentry, Resend, and repository access validation.

Production startup rejects missing database, GitHub, encryption, and user/admin JWT secrets.

## Development commands

From the repository root:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm format
```

API E2E tests require a dedicated throwaway database whose name contains `test`:

```bash
cp apps/api/.env.example apps/api/.env
# Verify TEST_DATABASE_URL points to a disposable test database.
pnpm --filter api test:e2e
```

The E2E suite truncates its database. Never point `TEST_DATABASE_URL` at development or production data.

Useful Prisma commands:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:dev
pnpm --filter api prisma:migrate:deploy
pnpm --filter api prisma:studio
pnpm --filter api prisma:seed
```

Pull-request CI runs lint, unit tests, typecheck, API E2E tests, and build.

## Production deployment

The implemented production target is a single AWS EC2 host using multi-stage images, internal PostgreSQL/Redis/Qdrant services, and Caddy TLS:

```bash
cp .env.production.example .env.production
# Replace every CHANGE_ME value.
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

See [EC2 deployment](docs/features/deploy-ec2.md) for host sizing, DNS, security groups, secrets, backups, upgrades, and recovery.

## Feature documentation

- [Current architecture](docs/Architecture.md)
- [End-to-end application flow](docs/features/main-app-flow.md)
- [Code intelligence](docs/features/code-intelligence.md)
- [Retrieval](docs/features/retrieval.md)
- [Living onboarding guides](docs/features/onboarding-guides.md)
- [Usage limits and AI providers](docs/features/usage-and-ai-providers.md)
- [Product roadmap](docs/Roadmap.md)

## Current architectural constraints

- Only TypeScript and JavaScript are parsed.
- Reindexing removes the old searchable index before the new one succeeds.
- A provider repository is globally unique and cannot currently be connected to multiple workspaces.
- Rate limiting is in-process and is not coordinated across API replicas.
- The production Compose topology is single-host.
- Mock AI providers validate integration behavior but not answer quality.
- Billing and self-service plan upgrades are not present.

These constraints are documented in more detail in [MVP Architecture](docs/Architecture.md).

## Contributing

The project is under active development. Keep implementation documentation aligned with shipped behavior, include tests for behavior changes, and run the root quality checks before opening a pull request.

## License

No license has been selected yet.
