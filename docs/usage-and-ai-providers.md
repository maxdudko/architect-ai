# Usage limits and AI providers

Phase 1 monetization foundation: plan-based usage limits, workspace usage visibility, Hosted AI, and Bring Your Own Key (BYOK). Billing and Stripe are intentionally out of scope.

## Limits

Limits are stored in `plan_limits` and keyed by `Workspace.plan` + metric. Business logic never hardcodes Free-plan numbers. Admins change limits from `/admin/usage`; the next request uses the new values.

| Metric | What is counted | Period |
|---|---|---|
| `REPOSITORIES` | Non-deleted connected repositories | Current |
| `INDEXING_RUNS` | Indexing runs started | Calendar month (UTC) |
| `GUIDE_GENERATIONS` | Onboarding guide generation runs created | Calendar month (UTC) |
| `AI_QUESTIONS` | User chat messages on non-deleted conversations | Calendar month (UTC) |
| `MEMBERS` | Active members + pending (unexpired) invitations | Current |

`max_value = null` means unlimited. New workspaces are always `FREE`. `PRO` and `ENTERPRISE` exist as unlimited stubs so a future billing system can flip `Workspace.plan` without changing usage code.

When a workspace is in **BYOK** (a saved OpenAI key), `AI_QUESTIONS` and `GUIDE_GENERATIONS` are treated as unlimited regardless of the plan row. `REPOSITORIES`, `INDEXING_RUNS`, and `MEMBERS` still use the plan caps. Removing the key restores Hosted AI and the plan limits for questions and guides.

Enforcement is server-side (`403`, `code: USAGE_LIMIT_EXCEEDED`) before the side effect. Post-index auto guide generation is skipped (not failed) when the guide limit is reached.

## Usage and analytics

Counts are live queries against existing tables. Product Validation analytics (`/admin/analytics`) is unchanged: repository events, questions, citations, feedback, and token usage remain observational.

Workspace members can read `GET /workspaces/:id/usage`. Platform admins can list all workspaces at `GET /admin/usage/workspaces`.

## AI providers

The AI provider is workspace-level and applies to **LLM generation only** (chat and onboarding guides). Embeddings stay on the platform `EMBEDDING_PROVIDER`.

- **Hosted AI** — no workspace key; uses the process `LLM_PROVIDER` / `OPENAI_API_KEY` (or Anthropic / mock).
- **BYOK** — a workspace Owner or Admin saves an OpenAI API key. Connecting a key switches to BYOK and uncaps AI questions and onboarding guides; removing it falls back to Hosted AI and plan limits.

Keys are encrypted at rest with `TOKEN_ENCRYPTION_KEY` (same AES-256-GCM cipher as GitHub OAuth tokens). The API never returns the plaintext key—only `mode` and `openaiKeyLast4`. Invalid BYOK keys fail the request; they do not silently fall back to Hosted AI.

Owners and admins can `POST /workspaces/:id/ai-settings/test` with an optional `openaiApiKey`. A pasted key is tested without saving it; an empty body tests the saved key. The endpoint calls OpenAI `GET /models` and does not count toward AI question usage.

## Out of scope

- Stripe, checkout, invoices, or self-serve plan changes
- Additional BYOK providers
- Per-workspace embeddings or vector collections
- Token quotas as plan limits (token usage remains an analytics cost proxy)
