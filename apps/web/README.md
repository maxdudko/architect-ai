# Architect AI Web

Production-ready frontend for Architect AI — an AI platform that helps engineering teams understand large codebases.

Built with Next.js App Router and a feature-based architecture designed to scale across product phases.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, design tokens (`src/styles/tokens.css`)
- **UI:** shadcn/ui-style primitives (Radix UI + CVA)
- **Data:** TanStack Query
- **Forms:** React Hook Form + Zod
- **HTTP:** Axios (`src/lib/api`)
- **Icons:** Lucide React
- **Theme:** next-themes (light / dark / system)
- **Toasts:** Sonner

## Getting Started

From the monorepo root:

```bash
pnpm install
pnpm --filter api dev   # API must be running (default: http://localhost:5000)
pnpm --filter web dev   # Frontend (default: http://localhost:3000)
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

The web app reads configuration from the monorepo root `.env` or environment variables at runtime:

| Variable                           | Default                 | Description                                  |
| ---------------------------------- | ----------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`         | `http://localhost:5000` | Backend API base URL                         |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` | `true`                  | Show Continue with Google (`false` hides it) |
| `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED` | `true`                  | Show Continue with GitHub (`false` hides it) |

The API must allow the web origin via CORS (`CORS_ORIGINS=http://localhost:3000` in `apps/api`).

## Scripts

```bash
pnpm --filter web dev        # Start dev server
pnpm --filter web build      # Production build
pnpm --filter web start      # Start production server
pnpm --filter web lint       # ESLint
pnpm --filter web typecheck  # TypeScript check
pnpm --filter web test       # Vitest
```

## Architecture

The codebase uses **feature-based architecture** — files are organized by product domain, not by component type.

```
src/
├── app/          # Next.js routes, layouts, error boundaries
├── features/     # auth, profile, workspace, repository, onboarding, chat, dashboard, landing, admin, invitation, settings
├── shared/       # Reusable UI components and primitives
├── entities/     # Domain types (User, Workspace, Membership, …)
├── widgets/      # Composed blocks (app shell, navigation)
├── lib/          # API client, auth storage, utilities
├── hooks/        # Global hooks (mobile, mounted, shortcuts)
├── providers/    # Auth, Query, Theme providers
└── styles/       # Design tokens
```

See [`src/ARCHITECTURE.md`](./src/ARCHITECTURE.md) for folder rationale and scaling principles.

### Feature modules

Each feature under `src/features/` contains:

- `components/` — UI for that feature
- `hooks/` — form and interaction hooks
- `services/` — TanStack Query mutations/queries or feature services
- `types/` — feature-specific TypeScript types
- `schemas/` — Zod validation schemas
- `index.ts` — barrel exports

**Phase 1 (shipped):** `auth`, `profile`, `workspace`, `repository`, `onboarding`, `chat`, `dashboard`, `landing`, `admin`, `invitation`

**Placeholder:** `settings` (personal account preferences beyond `/profile` name updates are not implemented)

Architecture Explorer and Decision Memory appear on the dashboard as later-phase placeholders.

### API layer

All HTTP calls go through `src/lib/api/`. Components and pages never import Axios directly.

| File                  | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `axios.ts`            | Shared client, auth header injection, 401 refresh hook                     |
| `auth.ts`             | Sign in, sign up, logout, session, identity OAuth, password reset, profile |
| `workspace.ts`        | List, create, update, switch workspaces                                    |
| `membership.ts`       | List, update role, and remove members                                      |
| `invitation.ts`       | Create, resend, preview, and accept invitations                            |
| `repository.ts`       | Connect, update, disconnect, retry, reindex, files, symbols                |
| `github.ts`           | Connect URL, connection status, public URL resolve, remotes and branches   |
| `conversation.ts`     | Conversations, messages, SSE stream, feedback                              |
| `onboarding-guide.ts` | List, generate, poll, and read onboarding guides                           |
| `usage.ts`            | Workspace usage                                                            |
| `workspace-ai.ts`     | Hosted vs BYOK provider settings                                           |
| `billing.ts`          | Plans, checkout, portal, downgrade, resume                                 |
| `contact.ts`          | Landing-page contact form                                                  |
| `admin-*.ts`          | Platform-admin auth, users, plans, usage, logs, analytics                  |

### Auth & session

- `AuthProvider` (`src/providers/auth-provider.tsx`) exposes `useAuth()`
- Session persisted in `localStorage` plus an access-token cookie for middleware
- Server-only cookie helpers live in `src/lib/auth/cookies.server.ts`
- Client-safe constants in `src/lib/auth/constants.ts`
- Protected routes use `AuthGuard` and `src/middleware.ts`

## Routes

### Public

| Route                    | Description                               |
| ------------------------ | ----------------------------------------- |
| `/`                      | Marketing landing page                    |
| `/sign-in`               | Email/password and identity OAuth sign in |
| `/sign-up`               | Create account                            |
| `/forgot-password`       | Request a password reset email            |
| `/reset-password/:token` | Set a new password from the email link    |
| `/auth/oauth/complete`   | Finishes Google/GitHub identity OAuth     |
| `/invitations/:token`    | Accept a workspace invitation             |

### Protected (app shell)

| Route                                         | Description                                    |
| --------------------------------------------- | ---------------------------------------------- |
| `/dashboard`                                  | Usage, repositories, conversations, and setup  |
| `/workspaces`                                 | List and create workspaces                     |
| `/workspace`                                  | Workspace hub (settings, members, invitations) |
| `/workspace/settings`                         | Name, usage, Stripe billing, and AI provider   |
| `/workspace/members`                          | View, change roles, and remove members         |
| `/workspace/invitations`                      | Invite teammates                               |
| `/repositories`                               | Connected repositories and connect flow        |
| `/repositories/:repositoryId`                 | Status, files, symbols, retry/reindex          |
| `/repositories/:repositoryId/guides`          | Living onboarding guide library                |
| `/repositories/:repositoryId/guides/:guideId` | Living onboarding guide detail                 |
| `/chat`                                       | Streaming repository or workspace chat         |
| `/profile`                                    | Update first and last name                     |
| `/settings`                                   | Personal settings placeholder                  |

### Admin

| Route              | Description                     |
| ------------------ | ------------------------------- |
| `/admin/sign-in`   | Separate platform-admin sign in |
| `/admin`           | Admin home                      |
| `/admin/users`     | User management                 |
| `/admin/plans`     | Plan limits and Stripe prices   |
| `/admin/usage`     | Workspace usage                 |
| `/admin/logs`      | System logs                     |
| `/admin/analytics` | Product analytics               |

### System

| Route                           | Description              |
| ------------------------------- | ------------------------ |
| `/unauthorized`                 | Not signed in            |
| `/forbidden`                    | Insufficient permissions |
| `not-found`, `error`, `loading` | App Router boundaries    |

## App shell

Authenticated pages render inside a shared shell:

1. **Top navigation** — logo, workspace switcher, breadcrumbs, theme toggle, user menu
2. **Sidebar** — Dashboard, Workspaces, Repositories, Chat
3. **Mobile drawer** — same navigation on small screens
4. **Content area** — page content

Keyboard shortcuts (when not focused in an input):

- `Shift + D` → Dashboard
- `Shift + W` → Workspace hub

## Forms

All forms use React Hook Form with Zod resolvers. Each form hook provides:

- Validation errors
- Loading state (`isSubmitting` / mutation pending)
- Error message on API failure
- Success message on completion

## Theming

Theme is controlled by `ThemeProvider` and toggled from the top nav (light / dark / system). Tokens are defined in `src/styles/tokens.css` and consumed via Tailwind utility classes.

## Development notes

- Use `@/` path alias for imports from `src/`
- Add new product areas as feature modules under `src/features/`
- Keep route files thin — compose from `features/`, `widgets/`, and `shared/`
- For server-only code (e.g. `next/headers`), use a `.server.ts` suffix and avoid importing it from client components

See [`docs/features/auth-and-identity.md`](../../docs/features/auth-and-identity.md) for password reset, profile, invitations, and GitHub identity vs repository connect.

See [`docs/features/onboarding-guides.md`](../../docs/features/onboarding-guides.md) for the Living Onboarding Guides flow and UI behavior.
