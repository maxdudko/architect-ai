# Architect AI

> **The collective engineering memory for software teams.**

Architect AI is an AI-powered platform that helps engineering teams understand large codebases, preserve architectural knowledge, and make better technical decisions.

Unlike traditional AI coding assistants, Architect AI focuses on **understanding systems**, not just generating code.

---

## Vision

Modern software teams lose valuable engineering knowledge every day.

Code remains in Git repositories, but the context behind architectural decisions often disappears when engineers leave, documentation becomes outdated, or systems evolve over time.

Architect AI aims to become the **digital Staff Engineer** for every engineering organization.

Our mission is simple:

> **Engineering knowledge should never leave the company.**

---

# Why Architect AI?

Today's AI tools help developers write code faster.

Architect AI helps teams answer much harder questions:

- How does this system work?
- Why was it designed this way?
- What will break if we change this?
- Where should new functionality be implemented?
- Why was this architectural decision made?

The goal is not replacing engineers.

The goal is making engineering knowledge permanent.

---

# Product Evolution

## Phase 1 — AI Onboarding Assistant

Accelerate onboarding by allowing developers to ask questions about an existing codebase.

Example questions:

- How does authentication work?
- Where is payment processing implemented?
- Which services use Redis?
- Where should I add a new API endpoint?

Features:

- GitHub integration
- Repository indexing
- AI-powered codebase chat
- Source references
- Automatic onboarding guides

---

## Phase 2 — Architecture Explorer

Understand system structure.

Features:

- Dependency visualization
- Module relationships
- Service mapping
- Architecture search

---

## Phase 3 — Decision Memory

Preserve engineering decisions.

Features:

- ADR generation
- Decision search
- Jira integration
- Notion integration
- Architectural history

---

## Phase 4 — Impact Analysis

Predict consequences before making changes.

Features:

- Change impact analysis
- Dependency analysis
- Test recommendations
- Team ownership mapping

---

## Phase 5 — AI Staff Engineer

Support engineering leaders during technical decision making.

Features:

- Design reviews
- Architecture validation
- ADR recommendations
- Pull request guidance
- Technical planning assistance

---

# Core Principles

## Engineering Memory

Store knowledge, not just documents.

---

## Explainability

Every AI answer includes source references.

---

## Human-Centered AI

Architect AI assists engineers rather than replacing them.

---

## Vendor Independence

AI providers can be swapped without affecting the platform architecture.

---

## Modular Architecture

Every subsystem is independently scalable.

---

# High-Level Architecture

```text
                     GitHub
                        │
                        ▼

             Repository Indexing Pipeline

                        │

        Tree-sitter Code Intelligence Layer

                        │

              Chunking & Embeddings

                        │

                    Qdrant

                        │

               Retrieval Engine

                        │

                Context Builder

                        │

                LLM Provider Layer

                        │

                  Chat Service

                        │

                 Next.js Frontend
```

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- NestJS
- Node.js

## Database

- PostgreSQL

## Vector Database

- Qdrant

## Queue

- BullMQ
- Redis

## Code Intelligence

- Tree-sitter

## AI

- Anthropic Claude
- OpenAI GPT
- Provider abstraction layer

---

# Repository Structure

```text
apps/
    web/
    api/

packages/
    shared/
    ui/
    ai/
    code-intelligence/

infrastructure/
    docker/

.github/
    workflows/

docs/
```

---

# Getting Started

## Requirements

- Node.js 20+
- pnpm
- Docker
- Docker Compose

---

## Installation

```bash
git clone <repository>

cd architect-ai

pnpm install

cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The root `.env` is used primarily for local infrastructure and web settings.  
The API reads runtime secrets and OAuth credentials from `apps/api/.env`.

For production-ready observability and abuse protection, configure:

```bash
# apps/api/.env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_LIMIT=120
RATE_LIMIT_DEFAULT_WINDOW_MS=60000
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# apps/web/.env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

---

## GitHub OAuth Setup (Required for Repository Connect)

Create a GitHub OAuth App and configure:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:5000/integrations/github/callback`

Then set these values in `apps/api/.env`:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:5000/integrations/github/callback
TOKEN_ENCRYPTION_KEY=replace-with-strong-random-secret
GITHUB_OAUTH_STATE_SECRET=replace-with-strong-random-secret
```

`TOKEN_ENCRYPTION_KEY` encrypts GitHub OAuth tokens and workspace OpenAI keys (BYOK). See [docs/usage-and-ai-providers.md](docs/usage-and-ai-providers.md).

If `GITHUB_CLIENT_ID` is missing, `GET /integrations/github/connect-url` returns `503` with a configuration error.

---

## Local Infrastructure and Containers

```bash
docker compose up -d --build
```

This starts:

- PostgreSQL
- Redis
- Qdrant
- API container
- Web container

Default host ports:

- Web: `3000`
- API: `5000`
- PostgreSQL: `5433`
- Redis: `6380`
- Qdrant: `6335` (HTTP), `6336` (gRPC)

---

## Start Development (Host Apps)

```bash
pnpm dev
```

This runs workspace `dev` tasks for both `apps/web` and `apps/api`.

---

## GitHub Connectivity Flow (MVP)

1. Web requests `GET /integrations/github/connect-url?workspaceId=<id>`
2. User completes GitHub consent screen
3. GitHub redirects to `GET /integrations/github/callback`
4. API stores OAuth tokens encrypted at rest
5. Web loads `GET /integrations/github/repositories?workspaceId=<id>`
6. User selects a repository and connects it to the workspace
7. Initial indexing is triggered asynchronously

Repository indexing statuses:

- `PENDING`
- `CLONING`
- `PARSING`
- `EMBEDDING`
- `READY`
- `FAILED`

On `FAILED`, users can trigger retry from the repositories UI.

---

## Quality Checks

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

These are the same checks executed in CI on pull requests.

---

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

Checks on pull requests:

- Lint
- Test
- Typecheck
- API E2E test
- Build

---

# MVP Workflow

```text
User

    │

Connect GitHub Repository

    │

Repository Indexed

    │

Code Parsed

    │

Embeddings Generated

    │

Repository Ready

    │

Ask Questions

    │

Receive AI Answer

    │

View Source References
```

---

# Example Questions

```text
How does authentication work?
```

---

```text
Where is user registration implemented?
```

---

```text
How is JWT validation performed?
```

---

```text
Which modules communicate with Billing?
```

---

```text
What is the entry point for payment processing?
```

---

# Roadmap

| Phase                   | Status         |
| ----------------------- | -------------- |
| AI Onboarding Assistant | 🚧 In Progress |
| Architecture Explorer   | Planned        |
| Decision Memory         | Planned        |
| Impact Analysis         | Planned        |
| AI Staff Engineer       | Planned        |
| Enterprise Platform     | Planned        |

---

# Design Goals

The architecture is intentionally built for long-term scalability.

Future integrations include:

- GitLab
- Bitbucket
- Azure DevOps
- Jira
- Linear
- Notion
- Confluence
- Slack

No major architectural changes should be required as the platform evolves.

---

# Long-Term Vision

Architect AI evolves through five stages:

```text
Chat with Code
        ↓
Understand Architecture
        ↓
Remember Decisions
        ↓
Predict Impact
        ↓
Guide Engineering Decisions
```

The final product becomes the engineering memory layer of an organization.

Instead of asking a senior engineer,

> "Do you know why we built it this way?"

teams will simply ask Architect AI.

---

# Contributing

This project is currently under active development.

Contributions, ideas, and discussions are welcome.

---

# License

TBD

---

> **"Code is the implementation. Architecture is the knowledge. Architect AI preserves both."**
