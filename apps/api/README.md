# Architect AI API

Backend service for authentication, workspaces, GitHub indexing, retrieval, chat, onboarding guides, billing, and platform admin.

## Architecture

This service follows a modular DDD-inspired structure:

- `src/auth`: email/password and Google/GitHub identity OAuth, password reset, profile updates, JWT strategy, token/session concerns
- `src/workspaces`: workspace lifecycle and active-workspace switching
- `src/memberships`: workspace access, roles, and member lifecycle
- `src/invitations`: invitation creation, resend, preview, and acceptance
- `src/users`: user persistence and user-domain service
- `src/integrations/github`: GitHub repository-connect OAuth and API client
- `src/repositories`: repository connect, status, files/symbols, indexing queue
- `src/repositories/indexing`: clone, parse, chunk, and embed worker stages
- `src/modules/code-intelligence`: Tree-sitter parse, symbols, relations, chunks
- `src/modules/retrieval`: embeddings, Qdrant, semantic search, context assembly
- `src/modules/llm`: hosted LLM provider adapters
- `src/conversations` / `src/chat`: persisted conversations, answers, SSE streaming
- `src/modules/onboarding`: living onboarding guide generation, storage, and worker
- `src/workspace-ai`: Hosted vs BYOK generation provider resolution
- `src/usage`: plan-limit enforcement and workspace usage
- `src/billing`: Stripe Checkout, portal, subscriptions, and webhooks
- `src/contact`: landing-page contact form
- `src/mail`: Resend transactional email (reset, invitations, contact)
- `src/admin`: platform-admin auth, users, plans, usage, logs, analytics
- `src/common`: reusable guards, decorators, and exception filter
- `src/prisma`: database gateway
- `prisma`: schema and seed data

Each module separates:

- Controller (transport and HTTP mapping)
- Service (business rules)
- Repository (persistence only)
- DTOs (validation contracts)
- Guards/decorators (cross-cutting authN/authZ)

The HTTP API and the indexing worker bootstrap the same NestJS `AppModule`. `INDEXING_WORKER_ENABLED` / `ONBOARDING_WORKER_ENABLED` keep queue consumers off the API process.

## Auth and Tenant Model

- JWT includes `sub`, `email`, and `activeWorkspaceId`
- Every protected request resolves current user from JWT
- Workspace access is validated through memberships
- Role-based checks use `@Roles(...)` with `RolesGuard`
- Refresh token session tracking is backed by Redis when `REDIS_URL` is configured
- `IdentityAccount` is Google/GitHub **sign-in**; `OAuthAccount` is GitHub **repository connect**

## API

Swagger is available at `GET /docs` outside production.

- Auth: `POST /auth/signup`, `POST /auth/signin`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`, `PATCH /auth/me`, `GET /auth/oauth/{google,github}/start`
- Workspaces: `GET /workspaces`, `POST /workspaces`, `PATCH /workspaces/:id`, `POST /workspaces/:id/switch`
- Membership: `GET /workspaces/:id/members`, `PATCH /workspaces/:id/members/:memberId`, `DELETE /workspaces/:id/members/:memberId`
- Invitation: `GET /workspaces/:id/invitations`, `POST /workspaces/:id/invitations`, `POST /workspaces/:id/invitations/:invitationId/resend`, `GET /invitations/:token`, `POST /invitations/:token/accept`
- GitHub: `GET /integrations/github/connect-url`, `GET /integrations/github/connection`, `DELETE /integrations/github/connection`, `GET /integrations/github/resolve`, list remotes and branches
- Repositories: connect, `PATCH`/`DELETE`, retry/reindex, files and symbols
- Chat: `POST /workspaces/:id/conversations`, `GET`/`PATCH`/`DELETE .../conversations/:conversationId`, `POST .../messages`, `POST .../messages/stream` (SSE), `POST .../messages/:messageId/feedback`
- Contact: `POST /contact`
- Living onboarding guides:
  - `GET /workspaces/:id/repositories/:repositoryId/guides`
  - `GET /workspaces/:id/repositories/:repositoryId/guides/generation-runs/latest`
  - `GET /workspaces/:id/repositories/:repositoryId/guides/:guideId`
  - `POST /workspaces/:id/repositories/:repositoryId/guides/generate`
  - `POST /workspaces/:id/repositories/:repositoryId/guides/regenerate`
- Usage and AI settings: `GET /workspaces/:id/usage`, `/workspaces/:id/ai-settings/*`
- Billing: `GET /plans`, `/workspaces/:id/billing` (checkout, portal, downgrade, resume), `POST /billing/webhook`
- Admin: separate admin JWT routes under `/admin/*`

See [`docs/features/auth-and-identity.md`](../../docs/features/auth-and-identity.md) for identity OAuth vs GitHub repository connect, password reset, profile, and invitations.

See [`docs/features/onboarding-guides.md`](../../docs/features/onboarding-guides.md) for the guide generation architecture and operations.

## Environment

Use `apps/api/.env.example` as a template.

Required for production (`NODE_ENV=production` fails fast if any are missing):

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ADMIN_ACCESS_SECRET`
- `JWT_ADMIN_REFRESH_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_STATE_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `AUTH_GITHUB_OAUTH_REDIRECT_URI`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `REDIS_URL` (recommended for session persistence; required for indexing and guide queues)

See [docs/features/deploy-ec2.md](../../docs/features/deploy-ec2.md) for the AWS EC2 Compose layout.

GitHub has two OAuth callbacks: `/integrations/github/callback` for repository connect (`GITHUB_OAUTH_REDIRECT_URI`) and `/auth/oauth/github/callback` for sign-in (`AUTH_GITHUB_OAUTH_REDIRECT_URI`). Google sign-in uses `/auth/oauth/google/callback`. Stripe webhooks use `POST /billing/webhook`. Password reset, invitations, and the landing contact form use Resend when `RESEND_API_KEY` is set.

## Local Commands

```bash
pnpm --filter api dev
pnpm --filter api dev:worker
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:dev
pnpm --filter api prisma:seed
```

The HTTP process does not consume indexing or onboarding queues. Run `dev:worker` in a second terminal for clone/parse/chunk/embed and guide generation.

### Seed credentials (local / non-production only)

| Role                 | Email                | Password            |
| -------------------- | -------------------- | ------------------- |
| Workspace owner user | `owner@architect.ai` | `Password123!`      |
| Platform admin       | `admin@architect.ai` | `AdminPassword123!` |

Platform admin signs in at `/admin/sign-in` (separate from user auth).

## Testing

Unit tests:

```bash
pnpm --filter api test
```

### End-to-end tests

> ⚠️ The e2e suite runs migrations and `TRUNCATE`s every table. It must run
> against a **dedicated, throwaway test database** — never your working DB.

Provide a `TEST_DATABASE_URL` (preferred) or a `DATABASE_URL` whose database
name contains `test`. The suite promotes `TEST_DATABASE_URL` to `DATABASE_URL`
automatically and refuses to run against any database that doesn't look like a
test database. Create the database once, then run the suite:

```bash
# one-time: create the throwaway test database
createdb architect-ai-test-db

TEST_DATABASE_URL="postgresql://architect-ai-user:architect-ai-password@localhost:5433/architect-ai-test-db?schema=public" \
  pnpm --filter api test:e2e
```

To bypass the safety check (e.g. in CI with an ephemeral database), set
`E2E_ALLOW_NON_TEST_DB=true`.
