# Documentation index

Implementation-first notes for the shipped Architect AI MVP. Later product phases live in the [roadmap](./Roadmap.md) and must not be read as deployed capabilities.

## Start here

| Doc                               | What it is                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| [Architecture](./Architecture.md) | Current system shape, tenancy, indexing, retrieval, security, and production constraints |
| [Roadmap](./Roadmap.md)           | Product direction after Phase 1                                                          |

## Feature notes

| Doc                                                                      | What it covers                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Main app flow](./features/main-app-flow.md)                             | Connect → index → chat and living guides, including the [indexing workflow diagram](./features/Repository%20Indexing%20Workflow.mmd) |
| [Auth and identity](./features/auth-and-identity.md)                     | Email/password, identity OAuth vs GitHub repo connect, password reset, profile, contact, invitations                                 |
| [Code intelligence](./features/code-intelligence.md)                     | Tree-sitter parse, symbols, relations, chunks                                                                                        |
| [Retrieval](./features/retrieval.md)                                     | Embeddings, Qdrant, semantic search, context assembly                                                                                |
| [Living onboarding guides](./features/onboarding-guides.md)              | Guide types, generation worker, REST, UI polling                                                                                     |
| [Dependency mapping](./features/dependency-mapping.md)                   | Folder-level modules, import-derived dependencies, confidence classification, known limitations                                      |
| [Architecture search](./features/architecture-search.md)                 | Closed structural questions over the dependency graph, epistemic labels, budgets, and limitations                                    |
| [Usage, billing, and AI providers](./features/usage-and-ai-providers.md) | Plan limits, Stripe, hosted vs BYOK generation                                                                                       |
| [Hostinger / VPS deployment](./features/deploy-hostinger.md)             | Step-by-step Docker Compose production deploy on Hostinger KVM (or similar Ubuntu VPS)                                               |
| [EC2 deployment](./features/deploy-ec2.md)                               | Same single-host layout on AWS EC2 (security groups, EBS, Elastic IP)                                                                |

Application READMEs: [root](../README.md), [API](../apps/api/README.md), [web](../apps/web/README.md).
