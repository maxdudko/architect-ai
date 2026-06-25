# Architect AI API

Backend service for authentication and workspace-centric multi-tenancy.

## Architecture

This service follows a modular DDD-inspired structure:

- `src/auth`: authentication application service, JWT strategy, token/session concerns
- `src/workspaces`: workspace lifecycle and active-workspace switching
- `src/memberships`: workspace access, roles, and member lifecycle
- `src/invitations`: invitation creation and acceptance
- `src/users`: user persistence and user-domain service
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

Swagger is available at `GET /docs`.

## Environment

Use `apps/api/.env.example` as a template.

Required for production:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `REDIS_URL` (recommended for session persistence)

## Local Commands

```bash
pnpm --filter api dev
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate:dev
pnpm --filter api prisma:seed
```
