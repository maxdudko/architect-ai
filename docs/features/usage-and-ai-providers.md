# Usage limits, billing, and AI providers

Phase 1 monetization: plan-based usage limits, workspace usage visibility, Hosted AI, Bring Your Own Key (BYOK), and Stripe self-serve subscriptions. Invoices other than Stripe's hosted Checkout/portal receipts, additional BYOK vendors, and per-workspace embeddings are out of scope.

## Limits

Limits are stored in `plan_limits` (usage quotas) and `plan_indexing_limits` (per-index resource caps), keyed by the workspace's current `Plan`. Business logic never hardcodes Free-plan numbers. Admins change limits from `/admin/plans` and `/admin/usage`; the next request uses the new values.

| Metric              | What is counted                                   | Period               |
| ------------------- | ------------------------------------------------- | -------------------- |
| `REPOSITORIES`      | Non-deleted connected repositories                | Current              |
| `INDEXING_RUNS`     | Indexing runs started                             | Calendar month (UTC) |
| `GUIDE_GENERATIONS` | Onboarding guide generation runs created          | Calendar month (UTC) |
| `AI_QUESTIONS`      | User chat messages on non-deleted conversations   | Calendar month (UTC) |
| `MEMBERS`           | Active members (pending invitations do not count) | Current              |

Indexing resource caps (not usage counts; BYOK does not uncap them):

| Metric                  | What is measured                                    |
| ----------------------- | --------------------------------------------------- |
| `REPOSITORY_SIZE_BYTES` | Cloned working tree size excluding `.git`           |
| `INDEXABLE_FILES`       | Scanner-supported source/manifest files             |
| `INDEXED_TOKENS`        | Sum of whitespace word counts on embedded chunks    |
| `EMBEDDING_CHUNKS`      | Chunks that would be sent to the embedding provider |
| `FILE_SIZE_BYTES`       | Per-file skip threshold for indexable candidates    |

`max_value = null` means unlimited. New workspaces are always `FREE`. Paid plans (`PRO` and others) store monthly prices and admin-editable limits. A plan can be marked `isContactSales` (typically Enterprise) so the UI offers a sales contact instead of Stripe Checkout.

When a workspace is in **BYOK** (has an active provider set), `AI_QUESTIONS` and `GUIDE_GENERATIONS` are treated as unlimited regardless of the plan row. `REPOSITORIES`, `INDEXING_RUNS`, `MEMBERS`, and indexing resource caps still use the plan values. Switching back to Hosted AI restores the plan limits for questions and guides. BYOK does not change the Stripe subscription price.

Enforcement is server-side (`403`, `code: USAGE_LIMIT_EXCEEDED` for quotas, `code: INDEXING_RESOURCE_LIMIT_EXCEEDED` for indexing caps) before the side effect. Post-index auto guide generation is skipped (not failed) when the guide limit is reached.

## Billing

`apps/api/src/billing/` owns Stripe Checkout, the customer portal, period-end downgrade/resume, and webhooks. Workspace owners and admins manage billing from `/workspace/settings`.

Public plans: `GET /plans` returns active plans with STANDARD and BYOK monthly prices and limits. The landing page and workspace billing card use this list.

Workspace billing endpoints (JWT, workspace-scoped):

| Method | Endpoint                            | Roles        | Behavior                                                                 |
| ------ | ----------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `GET`  | `/workspaces/:id/billing`           | members      | Current plan, billing mode, subscription status, period end              |
| `POST` | `/workspaces/:id/billing/checkout`  | Owner, Admin | Stripe Checkout for a paid plan (STANDARD monthly price)                 |
| `POST` | `/workspaces/:id/billing/portal`    | Owner, Admin | Stripe billing portal (requires an existing Stripe customer)             |
| `POST` | `/workspaces/:id/billing/downgrade` | Owner, Admin | Schedule cancel-at-period-end; workspace stays paid until Stripe deletes |
| `POST` | `/workspaces/:id/billing/resume`    | Owner, Admin | Reverse a scheduled period-end cancellation                              |

`POST /billing/webhook` verifies `Stripe-Signature` and applies subscription events. Processed event IDs are stored on `StripeWebhookEvent` so deliveries are idempotent. Checkout success returns to `/workspace/settings?billing=success`.

`WorkspaceSubscription` is the local subscription record (`status`, Stripe customer/subscription IDs, `currentPeriodEnd`, `cancelAtPeriodEnd`, `billingMode`). Checkout always uses the STANDARD monthly `PlanPrice`; BYOK is an AI-mode flag, not a separate Stripe price swap on toggle.

Required production env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Outside production the Stripe client can start without a real key; live Checkout/portal/webhook calls fail until credentials are set.

## Usage and analytics

Counts are live queries against existing tables. Product validation analytics (`/admin/analytics`) remain observational: repository events, questions, citation frequency, feedback, and token usage. Citation frequency is not source-click tracking.

Workspace members can read `GET /workspaces/:id/usage`. Platform admins can list all workspaces at `GET /admin/usage/workspaces`.

## AI providers

Architect AI is **model-agnostic**: the AI provider is a workspace-level choice that applies to **LLM generation only** (chat and onboarding guides). Embeddings always stay on the platform `EMBEDDING_PROVIDER`, regardless of which generation provider a workspace uses.

- **Hosted AI** — no workspace key; uses the process `LLM_PROVIDER` (`openai`, `anthropic`, `grok`, `gemini`, or `mock`) and its associated API key.
- **BYOK** — a workspace Owner or Admin saves an API key for one or more of **OpenAI, Anthropic, Grok, or Gemini**, then marks one as the workspace's active provider. A workspace can hold saved keys for multiple providers at once and switch its active provider instantly, without re-entering a key. Having an active provider switches the workspace to BYOK and uncaps AI questions and onboarding guides; switching back to Hosted AI (active provider = none) restores plan limits.

All provider adapters (`OpenAiLlmProvider`, `AnthropicLlmProvider`, `GrokLlmProvider`, `GeminiLlmProvider`) implement the same `LlmProvider` contract and are constructed through a single `buildLlmProvider` factory, shared by hosted configuration (`llm.module.ts`) and workspace BYOK resolution (`WorkspaceLlmResolver`), so the two call sites can never drift. Grok reuses the OpenAI adapter under the hood since xAI's chat-completions API is OpenAI-compatible; Gemini has its own adapter for Google's `generateContent` / `streamGenerateContent` request shape.

Keys are stored per provider in `workspace_ai_credentials` and encrypted at rest with `TOKEN_ENCRYPTION_KEY` (same AES-256-GCM cipher as GitHub OAuth tokens). The API never returns plaintext keys—only `mode`, `activeProvider`, and a `credentials` list with each provider's `keyLast4` and `updatedAt`. Invalid BYOK keys fail the request; they do not silently fall back to Hosted AI.

Workspace AI settings endpoints (Owner/Admin only), all under `/workspaces/:id/ai-settings`:

- `GET /` — current mode, active provider, and saved credential summaries.
- `PUT /credentials` — save (or replace) a key for a `provider` and activate it.
- `DELETE /credentials/:provider` — remove a saved key; clears the active provider if it was active.
- `POST /active` — switch the active provider (or set to `null` for Hosted AI) using an already-saved key.
- `POST /test` — test a `provider` key. Pass `apiKey` to test a pasted key without saving it, or omit it to test the saved key. Does not count toward AI question usage.

## Out of scope

- Additional BYOK providers beyond OpenAI, Anthropic, Grok, and Gemini
- Per-workspace embeddings or vector collections
- Token quotas as plan limits (token usage remains an analytics cost proxy)
- In-app invoice history beyond Stripe Checkout and the Stripe customer portal
