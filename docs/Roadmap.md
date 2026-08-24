# Architect AI

> The collective engineering memory for software teams.

## Vision

Modern software teams lose critical knowledge every day.

Code remains in repositories, but the reasoning behind architectural decisions often disappears with employee turnover, organizational changes, or simply the passage of time.

Architect AI aims to become the **digital Staff Engineer** for engineering organizations — preserving architectural knowledge, accelerating onboarding, reducing technical risk, and helping teams make better technical decisions.

Our mission is simple:

> **Ensure that engineering knowledge never leaves the company.**

---

# The Problem

Growing engineering teams face several recurring challenges:

- New developers require weeks or months to understand the system.
- Architectural decisions are poorly documented.
- Critical knowledge exists only in senior engineers' heads.
- Teams repeatedly revisit previously solved problems.
- Impact analysis is slow and unreliable.
- Existing AI coding assistants generate code but do not understand organizational context.

Current tools answer:

> "How do I write code faster?"

Architect AI answers:

> "How does this system work, why was it built this way, and what happens if we change it?"

---

# Product Principles

Architect AI is **not** another AI coding assistant.

It is built around four principles:

1. **Preserve engineering knowledge**
2. **Understand architecture, not just code**
3. **Provide explainable recommendations**
4. **Integrate naturally into existing workflows**

---

# Product Evolution

Phase 1 is **shipped** as the current MVP. Later phases are product direction, not deployed capabilities. Implementation status for the original Phase 1 epic is in [Phase 1 — AI Onboarding Assistant](./phase-1-ai-onboarding-assistant.md).

## Phase 1 — AI Onboarding Assistant (shipped)

### Goal

Reduce onboarding time for new engineers.

### Problem Solved

New team members struggle to understand unfamiliar codebases.

### Integrations

- GitHub
- GitLab (later)

### Features

#### Repository connect and index

Connect a GitHub repository and branch, then parse TypeScript, JavaScript, Python, and PHP asynchronously. Files, symbols, relations, chunks, and vectors stay searchable while a rebuild runs.

#### Repository and workspace chat

Ask questions with source citations and optional answer feedback. A conversation can target one repository or all ready repositories in the workspace.

Example questions:

- How does authentication work?
- Where is payment processing implemented?
- Which services use Redis?

#### Living onboarding guides

Generate evidence-backed Markdown guides from indexed topology and retrieval:

- executive summary and project overview
- folder, module, and service summaries
- technology stack, reading order, glossary, and common pitfalls

Guides are stored in Architect AI. The product does not write README files back into the repository and does not have a dedicated FAQ type.

#### Usage, BYOK, and billing

Plan-based usage limits, hosted or workspace-owned LLM keys (OpenAI, Anthropic, Grok, Gemini), Stripe self-serve plan changes, and a platform admin panel for analytics and limits.

### Success Metrics

These remain product goals, not engineering checkboxes:

- 50% reduction in onboarding time
- Weekly active usage by engineering teams
- Positive feedback from technical leads

---

# Phase 2 — Architecture Explorer

### Goal

Help teams understand system structure.

### Problem Solved

Developers cannot easily visualize large systems.

### Features

#### Dependency Mapping

Visualize:

- module dependencies
- package relationships
- service interactions

#### Architecture Search

Example questions:

- What depends on Auth?
- Which components communicate with Billing?
- Show all Kafka consumers.

#### System Overview

Generate architecture summaries automatically.

### Technical Additions

Phase 1 already parses code with Tree-sitter and stores `CodeSymbol` and `SymbolRelation`. This phase adds visualization and architecture search on that existing graph, plus richer dependency mapping.

### Success Metrics

- Engineers actively use architecture exploration
- Reduced time spent investigating unfamiliar systems

---

# Phase 3 — Decision Memory

### Goal

Capture the reasoning behind architectural decisions.

### Problem Solved

Teams forget why decisions were made.

### Integrations

- Jira
- Linear
- Notion
- Confluence

### Features

#### Decision Discovery

Example questions:

- Why did we choose PostgreSQL?
- Why was Billing extracted into its own service?

#### ADR Generation

Automatically generate Architecture Decision Records.

#### Decision Search

Search historical decisions by topic.

Examples:

- Scaling decisions
- Security decisions
- Infrastructure decisions

### Knowledge Model

Connect:

Code → PR → Ticket → Documentation → Decision

### Success Metrics

- Teams adopt ADR workflows
- Organizations rely on Architect AI during planning discussions

---

# Phase 4 — Impact Analysis

### Goal

Predict consequences before changes are implemented.

### Problem Solved

Developers struggle to estimate system-wide impact.

### Features

#### Change Impact Prediction

Example questions:

- What will break if this endpoint changes?
- Which services depend on this module?

#### Test Recommendations

Recommend:

- integration tests
- regression suites
- affected areas

#### Team Awareness

Identify:

- affected teams
- ownership boundaries
- potential coordination requirements

### Technical Additions

- Call graph analysis
- Ownership mapping
- Service dependency analysis
- Knowledge graph enrichment

### Success Metrics

- Reduction in production incidents
- Faster release planning
- Improved confidence in large refactors

---

# Phase 5 — AI Staff Engineer

### Goal

Assist teams in architectural decision-making.

### Problem Solved

Engineering leaders need support evaluating trade-offs.

### Features

#### Design Reviews

Example questions:

- Should Search become a separate service?
- Is this microservice extraction justified?

#### ADR Recommendations

Generate proposed decisions with:

- rationale
- alternatives
- risks
- trade-offs

#### Architecture Compliance

Detect deviations from established architectural principles.

#### Pull Request Guidance

Provide architectural feedback during reviews.

### Success Metrics

- Used during technical planning sessions
- Trusted by staff engineers and technical leads

---

# Phase 6 — Enterprise Platform

### Goal

Support large organizations with security and governance requirements.

### Features

#### Self-Hosted Deployment

- Kubernetes support
- Air-gapped environments

#### Security

- SSO
- RBAC
- Audit logs

#### Governance

- Data residency controls
- Compliance reporting
- Approval workflows

### Success Metrics

- Enterprise adoption
- Expansion within existing customers

---

# Long-Term Vision

Architect AI evolves from a repository assistant into an organizational intelligence platform.

Evolution path:

```text
Chat with Code
        ↓
Understand Architecture
        ↓
Remember Decisions
        ↓
Predict Impact
        ↓
Guide Technical Decisions
        ↓
Become the Engineering Memory Layer
```

---

# Competitive Positioning

The table describes the **intended** product, not the Phase 1 MVP. Today Architect AI explains indexed code with citations and generated guides. Decision Memory and Impact Analysis are later phases.

| Tool                            | Writes Code | Understands Architecture | Preserves Decisions | Predicts Impact |
| ------------------------------- | ----------- | ------------------------ | ------------------- | --------------- |
| GitHub Copilot                  | ✓           | Limited                  | ✗                   | ✗               |
| Cursor                          | ✓           | Partial                  | ✗                   | ✗               |
| Traditional Documentation Tools | ✗           | Partial                  | Partial             | ✗               |
| Architect AI (Phase 1 shipped)  | ✗           | Partial                  | ✗                   | ✗               |
| Architect AI (roadmap)          | Partial     | ✓                        | ✓                   | ✓               |

---

# Technical Stack

## Shipped (Phase 1)

### Frontend

- Next.js
- TypeScript

### Backend

- NestJS
- Node.js
- PostgreSQL, Redis, BullMQ

### AI Layer

- OpenAI, Anthropic, Grok, and Gemini adapters
- Workspace BYOK for generation
- Mock providers for local development

### Retrieval

- Qdrant semantic search
- PostgreSQL as source of truth for chunks and citations

### Code Intelligence

- Tree-sitter for TypeScript, JavaScript, Python, and PHP
- Static symbol and relation extraction

## Later phases

- Hybrid / lexical search and reranking
- Architecture visualization and richer dependency graphs
- Call graph generation beyond static syntax relations
- Knowledge graph, decision graph, and ADR ingestion
- Agent framework for design-review workflows

---

# Initial Target Customers

### Early Adopters

Teams with:

- 5–30 engineers
- multiple repositories
- growing technical complexity

### Expansion Market

Organizations with:

- 50–500 engineers
- multiple teams
- significant onboarding costs

### Enterprise

Large organizations requiring:

- self-hosted deployment
- compliance controls
- advanced governance capabilities

---

# Success Definition

Architect AI succeeds when engineering teams say:

> "We no longer depend on tribal knowledge to understand our systems."

The product should become the first place engineers go to answer questions about:

- how the system works,
- why it was built this way,
- and what happens if they change it.
