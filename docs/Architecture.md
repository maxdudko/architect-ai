# Phase 1 Architecture — AI Onboarding Assistant

## Objectives

Build an MVP that:

- Helps developers understand unfamiliar codebases.
- Reduces onboarding time.
- Can be implemented by a small team (or solo founder).
- Provides a solid foundation for future phases.
- Avoids expensive rewrites as the product evolves.

The architecture should support future expansion into:

- Architecture Explorer
- Decision Memory
- Impact Analysis
- AI Staff Engineer

---

# Architectural Principles

## 1. Event-driven indexing

Avoid tightly coupling GitHub ingestion to AI workflows.

All repository changes should become events.

Example:

```text
Repository Connected
    ↓
Repository Indexed
    ↓
Embeddings Generated
    ↓
Search Available
```

This allows future integrations without modifying existing components.

---

## 2. Separate retrieval from generation

Never mix RAG logic with LLM orchestration.

Bad:

```text
Chat Service
    ↓
Qdrant
    ↓
OpenAI
```

Good:

```text
Chat Service
    ↓
Retrieval Engine
    ↓
Context Builder
    ↓
LLM Service
```

---

## 3. Treat code intelligence as its own domain

Code parsing should not live inside the chat service.

Future phases will require richer analysis.

Separate it early.

---

## High-Level Architecture

```text
                ┌─────────────────┐
                │   Next.js App   │
                └────────┬────────┘
                         │
                         ▼
               ┌─────────────────┐
               │  API Gateway    │
               └────────┬────────┘
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼

┌─────────────┐ ┌─────────────┐ ┌────────────────┐
│ Repository  │ │ Chat Service│ │ User Service   │
│ Service     │ │             │ │                │
└─────┬───────┘ └──────┬──────┘ └────────────────┘
      │                │
      ▼                ▼

┌─────────────┐ ┌──────────────────┐
│ Indexing    │ │ Retrieval Engine │
│ Pipeline    │ │                  │
└─────┬───────┘ └─────────┬────────┘
      │                   │
      ▼                   ▼

┌─────────────┐ ┌──────────────────┐
│ Code Parser │ │ Context Builder  │
└─────┬───────┘ └─────────┬────────┘
      │                   │
      ▼                   ▼

┌─────────────┐ ┌──────────────────┐
│ PostgreSQL  │ │ LLM Provider     │
└─────────────┘ │ Abstraction Layer│
                └─────────┬────────┘
                          │
                          ▼

                  ┌────────────┐
                  │ Anthropic  │
                  │ OpenAI     │
                  └────────────┘


                    ▲
                    │

            ┌─────────────┐
            │ Qdrant      │
            │ Vector DB   │
            └─────────────┘
```

---

# Services

## API Gateway

Responsibilities:

- Authentication
- Request routing
- Rate limiting
- Session management

Technology:

```text
NestJS
```

---

## User Service

Responsibilities:

- User accounts
- Organizations
- Repository permissions

Database:

```text
PostgreSQL
```

---

Entities:

```typescript
User;

Organization;

Membership;

RepositoryAccess;
```

---

## Repository Service

Responsibilities:

- GitHub OAuth
- Repository connection
- Repository metadata

Future expansion:

- GitLab
- Bitbucket
- Azure DevOps

---

Database schema:

```typescript
Repository {
    id
    organizationId

    provider
    externalId

    owner
    name

    defaultBranch

    status
}
```

---

# Indexing Pipeline

Purpose:

Transform raw repositories into searchable knowledge.

---

Workflow:

```text
Repository Connected
        ↓
Clone Repository
        ↓
Parse Files
        ↓
Generate Chunks
        ↓
Create Embeddings
        ↓
Store Metadata
        ↓
Store Vectors
```

---

# Job Queue

Use asynchronous processing.

Technology:

```text
BullMQ
Redis
```

---

Jobs:

```text
CloneRepositoryJob

ParseRepositoryJob

ChunkRepositoryJob

EmbeddingJob

ReindexRepositoryJob
```

---

Future jobs:

```text
ADRExtractionJob

SlackIngestionJob

JiraIngestionJob

ImpactAnalysisJob
```

---

# Code Intelligence Layer

Purpose:

Understand repository structure.

---

Technology:

```text
Tree-sitter
```

---

Outputs:

```typescript
File;

Class;

Function;

Method;

Interface;

Import;

Export;
```

---

Store in PostgreSQL:

```typescript
CodeSymbol {
    id

    repositoryId

    type

    name

    path

    startLine

    endLine
}
```

---

Why relational?

Future phases require joins.

Example:

```text
Show all services importing BillingClient.
```

---

# Chunking Engine

Purpose:

Prepare semantic units for retrieval.

---

Avoid:

```text
1000 token windows
```

---

Use:

```text
Repository
    ↓
File
    ↓
Symbol
```

---

Chunk examples:

```text
AuthService.login()

AuthService.refresh()

JwtGuard.canActivate()
```

---

Schema:

```typescript
Chunk {
    id

    repositoryId

    symbolId

    content

    tokenCount
}
```

---

# Embedding Service

Purpose:

Convert chunks into vectors.

---

Interface:

```typescript
EmbeddingProvider {

    generate(text)

}
```

---

Phase 1 implementation:

```text
OpenAI

or

Voyage AI
```

---

Future:

```text
Self-hosted embeddings
```

---

# Vector Database

Technology:

```text
Qdrant
```

---

Collection structure:

```text
repository_chunks
```

---

Payload:

```json
{
  "repositoryId": "...",

  "filePath": "...",

  "symbolName": "...",

  "language": "typescript"
}
```

---

Why Qdrant?

- Open source
- Metadata filtering
- Hybrid search support
- Self-hostable

---

# Retrieval Engine

Purpose:

Find relevant information.

---

Pipeline:

```text
Question
    ↓
Intent Detection
    ↓
Metadata Filter Selection
    ↓
Vector Search
    ↓
Reranking
    ↓
Context Assembly
```

---

Example:

Question:

```text
How authentication works?
```

Intent:

```text
Architecture Explanation
```

Filters:

```text
language = typescript
```

Retrieve:

```text
JwtGuard

AuthService

LoginController
```

---

Future:

```text
Knowledge Graph Retrieval
```

---

# Context Builder

Purpose:

Prepare high-quality prompts.

---

Inputs:

```text
User Question

Repository Summary

Retrieved Chunks

Instructions
```

---

Prompt template:

```text
You are a senior engineer helping a new team member.

Answer clearly.

Reference source files.

Avoid assumptions.

If information is missing, say so.
```

---

# LLM Abstraction Layer

Purpose:

Avoid vendor lock-in.

---

Interface:

```typescript
LLMProvider {

    generate()

}
```

---

Phase 1:

```text
Claude Sonnet
```

Fallback:

```text
GPT
```

---

Future:

```text
Local Models

Hybrid Routing
```

---

# Chat Service

Purpose:

Coordinate conversations.

---

Responsibilities:

- Manage chat sessions
- Invoke retrieval
- Invoke LLMs
- Stream responses

---

Database:

```typescript
Conversation;

Message;
```

---

Future expansion:

```text
Architect Agent

Decision Agent

Review Agent
```

---

# Frontend

Technology:

```text
Next.js

TypeScript

Tailwind
```

---

Pages:

```text
Dashboard

Repository Setup

Chat

Onboarding Guides
```

---

Components:

```text
Repository Selector

Chat Window

Source References

Answer Feedback
```

---

# Source References

Critical MVP feature.

---

Every answer should cite sources.

Example:

```text
Authentication uses JWT.

Sources:

auth.service.ts

jwt.guard.ts

login.controller.ts
```

---

This dramatically increases trust.

---

# Database Architecture

## PostgreSQL

Stores:

```text
Users

Organizations

Repositories

Conversations

Messages

Symbols

Chunks Metadata
```

---

## Qdrant

Stores:

```text
Embeddings

Search Payloads
```

---

## Redis

Stores:

```text
BullMQ Jobs

Caching

Rate Limits
```

---

# Deployment

Phase 1 should remain simple.

---

Infrastructure:

```text
Docker Compose
```

Services:

```text
frontend

backend

postgres

redis

qdrant
```

---

Cloud:

```text
AWS ECS

or

Hetzner
```

---

Avoid Kubernetes initially.

---

# Evolution Path

Phase 1:

```text
GitHub
    ↓
Code RAG
    ↓
Chat
```

Phase 2:

```text
+ Architecture Graph
```

Phase 3:

```text
+ Jira
+ Notion
+ Decision Memory
```

Phase 4:

```text
+ Impact Analysis
+ Ownership Models
```

Phase 5:

```text
+ Multi-Agent System
+ AI Staff Engineer
```

---

# Why This Architecture Scales

Because responsibilities are isolated.

```text
Repository ingestion
        ≠
Code intelligence
        ≠
Retrieval
        ≠
LLM orchestration
        ≠
User experience
```

Each component can evolve independently without forcing a platform rewrite.

That flexibility is what will allow Architect AI to evolve from a simple onboarding assistant into a true engineering memory platform.
