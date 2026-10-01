# Architecture Search

Second feature of Phase 2 — Architecture Explorer. It answers a closed
set of structural questions from the dependency graph already produced
by Dependency Mapping. It does not derive modules, draw the map, or
generate a System Overview.

Spec: [docs/specs/phase-2-architecture-explorer/architecture-search/spec.md](../specs/phase-2-architecture-explorer/architecture-search/spec.md).
Resolved questions: [decisions.md](../specs/phase-2-architecture-explorer/decisions.md).

## Module layout

`apps/api/src/modules/architecture/architecture-search/`

- `architecture-search.service.ts` — revision selection, classification, resolution, retrieval, persistence
- `architecture-search-prompt.builder.ts` — classifier and answer prompts
- `module-name-resolver.ts` — deterministic name matching
- `structural-query.ts` — bounded neighborhood from the existing graph
- `dto/` — request and response contracts

`apps/web/src/features/architecture/` holds the Search page next to the
dependency map. The page is
`/repositories/[repositoryId]/architecture/search`.

## Intents

One structured model call returns an intent and the names the person
typed. Code resolves those names. The model never chooses a module.

| Intent               | Answer                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| `DEPENDENTS_OF`      | Modules that import the named module                                          |
| `DEPENDENCIES_OF`    | Modules the named module imports                                              |
| `CONNECTED_TO`       | Both directions, kept distinct                                                |
| `MODULE_REFERENCES`  | Modules that import the module containing a named file or utility             |
| `SOURCE_EXPLANATION` | Source context only. Retrieval may illustrate. It cannot create a dependency  |
| `NOT_ESTABLISHABLE`  | Runtime, brokers, traffic, deployment. No structural inventory                |
| `UNSUPPORTED`        | Anything else, including transitive “everything that ultimately depends on X” |

Ambiguous names, unknown names, and unsupported questions get a
deterministic reply. They do not receive a second generation.

## Who can ask

`OWNER`, `ADMIN`, and `MEMBER` can ask and rate. `VIEWER` can read
prior answers on the architecture page and cannot ask or rate. A
repository in another workspace returns **404** before any graph or
retrieval read.

## Metering and persistence

Each accepted question is a `USER` message on a non-deleted
conversation, so existing usage accounting counts it as
`AI_QUESTIONS`. Quota is checked before the message is written. A
repository with no successful index is refused before any message
exists.

`ConversationPurpose` is `CHAT` (the default) or `ARCHITECTURE_SEARCH`.
There is one architecture conversation per workspace, repository, and
author. Chat listing returns only `CHAT`, so repository chat and the
dashboard conversation widget stay unchanged.

Structural findings and structural evidence live in assistant
`Message.metadata`. Retrieved chunks still go through
`MessageSourceCitation`. Structural evidence is not stored there,
because it has no `chunkId`. Feedback uses the existing chat feedback
endpoint on that assistant message.

## Budgets

These limits are fixed. Requests cannot raise them.

| Budget                                 |                                  Limit |
| -------------------------------------- | -------------------------------------: |
| Question length                        |                       2,000 characters |
| Module names sent to the classifier    | 40, same significance order as the map |
| Dependencies and dependents per answer |                                25 each |
| Evidence items per finding             |                                     20 |
| Ambiguous candidates returned          |                                     10 |
| Retrieval `topK`                       | 8, pinned to the selected indexing run |
| Retrieved source text                  |                       8,000 characters |
| Structured facts                       |                      12,000 characters |

Truncation is stated in the prompt and in the answer.

## Revision

The revision is chosen once, at the start, from the latest succeeded
indexing run — the same lookup Dependency Mapping uses. Retrieval,
findings, and evidence all use that id. A newer run completing
mid-question does not change the answer. `rebuildInProgress` is
reported the same way as the map. A stored answer whose revision is
older than the latest succeeded run is labeled historical.

## Epistemic labels

The API stores one label on the answer. The page shows it without a
detail view.

| Label               | Meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `OBSERVED`          | A resolved import in this revision, with evidence copied from the graph |
| `INTERPRETED`       | Retrieved source the model may discuss. Not proof of a dependency       |
| `NOT_ESTABLISHABLE` | Indexed data cannot establish the claim                                 |

The model does not emit evidence items. Evidence is copied from the
graph and from retrieval. Repository text in the prompt is untrusted.
A retrieval score is never upgraded into a dependency. Absence of an
edge is worded as “no relationship observed”, including PHP and
plain-Python imports the map already leaves unresolved.

## Limitations

- Answers reflect statically observed imports in one indexing revision.
- Absence of a relationship is not proof that no runtime dependency exists.
- Semantic similarity and retrieval rank are not evidence of a dependency.
- Only import relationships can produce a module dependency.
- Modules are folder groupings. They are not deployment units, packages, or services.
- Transitive closure, brokers, traffic, and deployment topology are outside this feature.
