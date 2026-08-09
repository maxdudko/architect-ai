# Architect AI API

Backend service for authentication and workspace-centric multi-tenancy.

## Architecture

This service follows a modular DDD-inspired structure:

- `src/auth`: authentication application service, JWT strategy, token/session concerns
- `src/workspaces`: workspace lifecycle and active-workspace switching
- `src/memberships`: workspace access, roles, and member lifecycle
- `src/invitations`: invitation creation and acceptance
- `src/users`: user persistence and user-domain service
- `src/modules/onboarding`: living onboarding guide generation, storage, and worker
- `src/common`: reusable guards, decorators, and exception filter
- `src/prisma`: database gateway
- `prisma`: schema and seed data

Each module separates:

- Controller (transport and HTTP mapping)
- Service (business rules)
- Repository (persistence only)
- DTOs (validation contracts)
- Guards/decorators (cross-cutting authN/authZ)

## Auth and Tenant Model

- JWT includes `sub`, `email`, and `activeWorkspaceId`
- Every protected request resolves current user from JWT
- Workspace access is validated through memberships
- Role-based checks use `@Roles(...)` with `RolesGuard`
- Refresh token session tracking is backed by Redis when `REDIS_URL` is configured

## API

- Auth:
  - `POST /auth/signup`
  - `POST /auth/signin`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /auth/me`
- Workspaces:
  - `GET /workspaces`
  - `POST /workspaces`
  - `PATCH /workspaces/:id`
  - `POST /workspaces/:id/switch` (requires `refreshToken` in body; rotates tokens)
- Membership:
  - `GET /workspaces/:id/members`
  - `DELETE /workspaces/:id/members/:memberId`
- Invitation:
  - `POST /workspaces/:id/invitations`
  - `POST /invitations/:token/accept`
- Living onboarding guides:
  - `GET /workspaces/:id/repositories/:repositoryId/guides`
  - `GET /workspaces/:id/repositories/:repositoryId/guides/generation-runs/latest`
  - `GET /workspaces/:id/repositories/:repositoryId/guides/:guideId`
  - `POST /workspaces/:id/repositories/:repositoryId/guides/generate`
  - `POST /workspaces/:id/repositories/:repositoryId/guides/regenerate`

Swagger is available at `GET /docs`.
See [`docs/onboarding-guides.md`](../../docs/onboarding-guides.md) for the guide generation architecture and operations.

## Environment

Use `apps/api/.env.example` as a template.

Required for production:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ADMIN_ACCESS_SECRET`
- `JWT_ADMIN_REFRESH_SECRET`
- `REDIS_URL` (recommended for session persistence)

## Local Commands

```bash
pnpm --filter api dev
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:dev
pnpm --filter api prisma:seed
```

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
