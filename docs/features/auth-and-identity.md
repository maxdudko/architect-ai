# Auth and identity

Phase 1 identity: email/password accounts, Google and GitHub **sign-in**, GitHub **repository connect**, password reset, profile name updates, workspace memberships, and invitations. Personal `/settings` remains a placeholder. SSO and SCIM are out of scope.

## Account types

Two GitHub OAuth apps (or one app with two callback URLs) are involved:

| Flow                                 | Persistence                                                                | Grants                                                           |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Google / GitHub **identity** sign-in | `IdentityAccount`                                                          | Application login only. Does not grant GitHub repository access. |
| GitHub **repository connect**        | `OAuthAccount` (tokens encrypted with `TOKEN_ENCRYPTION_KEY`, AES-256-GCM) | Clone and list repositories for indexing.                        |

Email/password accounts store a bcrypt `passwordHash`. Identity-only accounts have no password; requesting a reset for those emails sends an OAuth sign-in reminder instead of a reset link.

Sign-up creates a personal `FREE` workspace and `OWNER` membership. Roles are `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER`. The access JWT carries `sub`, `email`, and `activeWorkspaceId`. Refresh tokens rotate and are stored in an HTTP-only cookie; Redis is the session store when `REDIS_URL` is set.

Platform admins use separate credentials, JWT secrets, routes (`/admin/*`), and UI state.

## Password reset

| Method | Endpoint                | UI                        |
| ------ | ----------------------- | ------------------------- |
| `POST` | `/auth/forgot-password` | `/forgot-password`        |
| `POST` | `/auth/reset-password`  | `/reset-password/[token]` |

`PasswordResetService` always returns `{ success: true }` for unknown emails so callers cannot probe accounts. Tokens are hashed at rest, expire after one hour, and are single-use. A successful reset invalidates the user's refresh sessions.

Mail uses Resend (`RESEND_API_KEY`, `MAIL_FROM`). Without a key, the API logs the reset URL for local development and does not send email.

## Profile vs settings

| Surface                                                       | Status                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `PATCH /auth/me` with `firstName` / `lastName`; UI `/profile` | Shipped                                                                      |
| `/settings`                                                   | Placeholder. Account preferences and extra integrations are not implemented. |

## Contact

`POST /contact` accepts the landing-page form (name, email, message). `ContactService` emails `CONTACT_TO_EMAIL` (default `sales@architect.ai`) and sends an acknowledgement to the submitter when Resend is configured.

## Memberships and invitations

Workspace members:

| Method   | Endpoint                            | Roles        | Behavior    |
| -------- | ----------------------------------- | ------------ | ----------- |
| `GET`    | `/workspaces/:id/members`           | all members  | List        |
| `PATCH`  | `/workspaces/:id/members/:memberId` | Owner, Admin | Update role |
| `DELETE` | `/workspaces/:id/members/:memberId` | Owner, Admin | Remove      |

Invitations:

| Method | Endpoint                                           | Behavior                    |
| ------ | -------------------------------------------------- | --------------------------- |
| `GET`  | `/workspaces/:id/invitations`                      | List pending (Owner, Admin) |
| `POST` | `/workspaces/:id/invitations`                      | Create and email invite     |
| `POST` | `/workspaces/:id/invitations/:invitationId/resend` | Resend email                |
| `GET`  | `/invitations/:token`                              | Public preview              |
| `POST` | `/invitations/:token/accept`                       | Accept; issues a session    |

Invitation emails also use Resend. If delivery fails, the pending invitation is kept; the list includes a copyable `inviteUrl`, and create/resend return `emailSent: false` instead of rolling back. Pending invitations do not consume a seat until accepted.

## GitHub connection (user-scoped)

Repository-connect tokens belong to the **user**, not the workspace:

| Method   | Endpoint                                                 | Behavior                                   |
| -------- | -------------------------------------------------------- | ------------------------------------------ |
| `GET`    | `/integrations/github/connect-url`                       | Signed OAuth start URL                     |
| `GET`    | `/integrations/github/callback`                          | OAuth callback                             |
| `GET`    | `/integrations/github/connection`                        | Connection status                          |
| `DELETE` | `/integrations/github/connection`                        | Disconnect                                 |
| `GET`    | `/integrations/github/resolve`                           | Public `owner/repo` or GitHub URL          |
| `GET`    | `/integrations/github/repositories`                      | List remotes the connected account can see |
| `GET`    | `/integrations/github/repositories/:externalId/branches` | List branches                              |

If the connecting user leaves or the token expires, clone and reindex require someone to reconnect GitHub.

## Related modules

- API: `apps/api/src/auth`, `apps/api/src/auth/oauth`, `apps/api/src/mail`, `apps/api/src/contact`, `apps/api/src/memberships`, `apps/api/src/invitations`, `apps/api/src/integrations/github`
- Web: `apps/web/src/features/auth`, `apps/web/src/features/profile`, `apps/web/src/features/invitation`, landing contact form
