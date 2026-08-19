# Usage limits and AI providers

Phase 1 monetization foundation: plan-based usage limits, workspace usage visibility, Hosted AI, and Bring Your Own Key (BYOK). Billing and Stripe are intentionally out of scope.

## Limits

Limits are stored in `plan_limits` and keyed by `Workspace.plan` + metric. Business logic never hardcodes Free-plan numbers. Admins change limits from `/admin/usage`; the next request uses the new values.

| Metric              | What is counted                                  | Period               |
| ------------------- | ------------------------------------------------ | -------------------- |
| `REPOSITORIES`      | Non-deleted connected repositories               | Current              |
| `INDEXING_RUNS`     | Indexing runs started                            | Calendar month (UTC) |
| `GUIDE_GENERATIONS` | Onboarding guide generation runs created         | Calendar month (UTC) |
| `AI_QUESTIONS`      | User chat messages on non-deleted conversations  | Calendar month (UTC) |
| `MEMBERS`           | Active members + pending (unexpired) invitations | Current              |

`max_value = null` means unlimited. New workspaces are always `FREE`. `PRO` and `ENTERPRISE` exist as unlimited stubs so a future billing system can flip `Workspace.plan` without changing usage code.

When a workspace is in **BYOK** (has an active provider set), `AI_QUESTIONS` and `GUIDE_GENERATIONS` are treated as unlimited regardless of the plan row. `REPOSITORIES`, `INDEXING_RUNS`, and `MEMBERS` still use the plan caps. Switching back to Hosted AI restores the plan limits for questions and guides.

Enforcement is server-side (`403`, `code: USAGE_LIMIT_EXCEEDED`) before the side effect. Post-index auto guide generation is skipped (not failed) when the guide limit is reached.

## Usage and analytics

Counts are live queries against existing tables. Product Validation analytics (`/admin/analytics`) is unchanged: repository events, questions, citations, feedback, and token usage remain observational.

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

- Stripe, checkout, invoices, or self-serve plan changes
- Additional BYOK providers beyond OpenAI, Anthropic, Grok, and Gemini
- Per-workspace embeddings or vector collections
- Token quotas as plan limits (token usage remains an analytics cost proxy)
