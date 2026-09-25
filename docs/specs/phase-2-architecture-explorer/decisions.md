# Phase 2 — Architecture Explorer: implementation decisions

Record of resolved open questions and deviations, as required by
Phase 2 §12 (Definition of Done).

Scope of this record: **Dependency Mapping** and **Architecture Search**.
System Overview questions stay deferred so the record remains complete.

Implemented in `apps/api/src/modules/architecture/` and
`apps/web/src/features/architecture/`. Known limitations are documented
separately in [docs/features/dependency-mapping.md](../../features/dependency-mapping.md).

## Note on question numbering

The Dependency Mapping spec references `Q-1`, `Q-3`, `Q-5` and `Q-9`
but ends at §17 without a question list, so the questions themselves
are restated below. The numbering follows the parent spec §11, which
is the list the references resolve against.

## Resolved

### Q-1 — Module detection rules in the MVP

**Decision.** Modules are folder groupings derived from the indexed
file inventory of a single revision, using the same rules the
onboarding topology analyzer already applies:

- group by the leading folder path of at most **2 segments**
- a folder becomes a module only with at least **2 indexed files**
- exclude paths matching `test|spec|fixture|vendor|generated|dist|build|node_modules`
- exclude files that indexing marked ignored, binary or generated

**Why.** Reusing the existing precedent means Dependency Mapping and
the onboarding guides describe the same repository the same way. No
new heuristic is introduced and no configuration surface is added.

**Consequence.** Modules are folders, not packages, services or
deployment units. Rules and exclusion counts are returned with every
view (`groupingRules`, `exclusions`) so the surface can state how
modules were formed and which files were dropped.

Implemented by `ModuleGrouperService`; constants in
`dependency-map.constants.ts`.

### Q-2 — Relationship types present in `SymbolRelation`

**Decision.** The six existing types are `IMPORTS`, `EXPORTS`,
`EXTENDS`, `IMPLEMENTS`, `CALLS` and `USES`. No type is added,
renamed or repurposed (RS-2).

Only `IMPORTS` is written with a `targetFilePath`. The other five
record a `toSymbolQualifiedName` with no location signal.

### Q-3 — Which types may contribute to a module dependency

**Decision (user-selected): imports only.** Only `IMPORTS` may
produce a module-to-module edge. `EXPORTS`, `EXTENDS`, `IMPLEMENTS`,
`CALLS` and `USES` are counted and reported, never drawn.

**Why.** RS-4 requires every drawn dependency to carry a confidence
classification grounded in evidence. A type with no target location
cannot be classified without guessing which of several same-named
symbols was meant, and a guess would be indistinguishable from a fact
in the UI.

**Consequence.** The view under-reports: a real inheritance or call
across module boundaries produces no edge. This is stated in the
returned `limitations` and surfaced in the UI. Non-import types are
reported as repository-level `nonDependencyRelationCounts` so RS-2 is
still satisfied.

### Q-4 — Graph visualization library

**Decision (user-selected): none.** Dependency Mapping ships as a
list explorer — a module inventory table plus dependencies and
dependents panels — with no new frontend dependency.

**Why.** The spec's mandatory behaviour is reversible aggregation
(RS-6) and visible evidence (EV-\*), both of which a table and a
detail panel serve directly. A node-link canvas would add a
dependency and a rendering budget without serving a required
behaviour, and at the declared module bound it would mostly be
unreadable.

**Consequence.** No spatial overview of the repository. Deferred
until a Phase 2 feature actually requires one.

### Q-5 — Graph size limits

**Decision.** Fixed, documented, non-overridable thresholds
(LG-4), declared in `DEPENDENCY_MAP_LIMITS`:

| Bound                             | Value |
| --------------------------------- | ----- |
| Modules per repository view       | 40    |
| Dependencies per module           | 25    |
| Dependents per module             | 25    |
| Evidence items per dependency     | 20    |
| Unresolved targets per module     | 20    |
| External targets per module       | 20    |
| Files per module detail           | 50    |
| Notable symbols per module detail | 50    |

Separately, a derivation ceiling of **20,000 files** and **50,000
distinct import rows** per revision (`DEPENDENCY_MAP_CEILING`) caps
the cost of one derivation (AD-6, LG-5).

**Why.** No request parameter widens a bound, so no caller can ask
for an unbounded result (FR-9).

**Consequence.** Truncation is disclosed rather than hidden. Every
bounded set returns `{ limit, returned, total, truncated }`, and
hitting the ceiling puts the whole view in the `PARTIAL` state with
stated reasons. Modules are ordered by significance
(`fileCount + symbolCount + outgoing + incoming`, tie-broken by key)
so truncation is deterministic for a revision.

### Q-9 — Source reference format

**Decision.** One shape for all of Phase 2:
`ArchitectureSourceReferenceDto`, with field names matching the
existing `CodeSymbolResponseDto` (`repositoryId`, `filePath`,
`startLine`, `endLine`, `name`, `qualifiedName`, plus `relationType`).

**Why.** EV-2 requires adopting one consistent shape rather than
introducing a fourth. Matching the symbol DTO lets the web
application reuse the components it already has.

**Consequence.** `startLine` and `endLine` are nullable, because
import relationships are recorded against the whole-file module
symbol and carry no line.

Exported from `ArchitectureModule` for Architecture Search and System
Overview to reuse.

### Q-10 — Automated tests per acceptance criterion

**Decision.** Acceptance criteria are covered by API e2e tests in
`apps/api/test/architecture-dependency-map.e2e-spec.ts` (AC-1, AC-2,
AC-3, AC-4, AC-5, AC-6, AC-7, AC-11, AC-12, plus cross-workspace
isolation and unknown-module handling), backed by unit specs for the
resolver, grouper, builder, service and provider. Web coverage is
Vitest over the query hooks, API layer and presentation utilities, in
line with the existing web test convention (node environment, no
component rendering).

### Q-6 — Supported architecture search intents

**Decision.** A closed set, classified by one structured LLM call that
returns the intent and the raw names the user typed. Code resolves those
names against the dependency graph. The model never chooses a module.

| Intent               | Meaning                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `DEPENDENTS_OF`      | What depends on a named module                                        |
| `DEPENDENCIES_OF`    | What a named module depends on                                        |
| `CONNECTED_TO`       | Both directions, kept distinct                                        |
| `MODULE_REFERENCES`  | Which modules import the module that contains a named file or utility |
| `SOURCE_EXPLANATION` | Source context only; retrieval cannot create a dependency             |
| `NOT_ESTABLISHABLE`  | Runtime, brokers, traffic, or deployment; no structural inventory     |
| `UNSUPPORTED`        | Anything else, including transitive "everything that depends on X"    |

### Q-12 — Whether the read-only role may ask

**Decision.** Asking matches chat: `OWNER`, `ADMIN`, and `MEMBER`.
`VIEWER` can read prior answers on the architecture page and cannot ask
or rate them.

### Q-4 — Metering architecture questions

**Decision.** Each accepted question is a `USER` message on a
non-deleted conversation, so the existing `AI_QUESTIONS` count includes
it. Quota is checked before the message is written. A repository with no
successful index is refused before any message exists.

### Q-3 and Q-5 — What is persisted, and how structural evidence is cited

**Decision.** `Conversation.purpose` is `CHAT` or `ARCHITECTURE_SEARCH`.
One architecture conversation exists per workspace, repository, and
author. Chat listing returns only `CHAT`. Structural findings and
structural evidence live in assistant message metadata. Retrieved chunks
still use `MessageSourceCitation`. Structural evidence is not stored
there, because that table requires a chunk id. Feedback uses the
existing answer-feedback endpoint on the assistant message.

### Q-6 (search spec) — Source reference shape

**Decision.** Reuse `ArchitectureSourceReferenceDto`, already chosen for
Dependency Mapping.

### Q-8 — Context budget

**Decision.** Fixed, not overridable:

| Bound                                  | Value             |
| -------------------------------------- | ----------------- |
| Question length                        | 2,000 characters  |
| Module names sent to the classifier    | 40                |
| Dependencies or dependents per finding | 25                |
| Evidence items per dependency          | 20                |
| Ambiguous module candidates            | 10                |
| Retrieval results                      | 8                 |
| Retrieved source text                  | 8,000 characters  |
| Structured facts                       | 12,000 characters |

Retrieval is pinned to the indexing revision selected for the question.
Truncation is stated in the prompt and on the answer.

## Deferred

| Question                             | Owner           |
| ------------------------------------ | --------------- |
| Q-7 — System Overview output schema  | System Overview |
| Q-8 — Concurrent overview generation | System Overview |

## Deviations

Each item below departs from a literal reading of the spec. None
removes a mandatory behaviour.

### D-1 — Derived on demand and cached, not persisted

**Spec.** AD-1 leaves persistence open; the model must be
representable, not necessarily stored.

**Decision (user-selected).** The graph is derived in the API from
rows already in Postgres and cached in Redis, keyed by
`indexingRunId`, for 600 seconds, with an in-memory fallback and an
in-process single-flight map collapsing concurrent derivations.

**Effect.** No Prisma migration and no re-index. Existing indexed
repositories gain the feature immediately. The cost is a cold-start
derivation per revision.

### D-2 — Revision non-mixing is structural, not checked

**Spec.** IR-3 forbids mixing revisions in one view.

**Decision.** The service resolves the latest succeeded revision once
per request and passes that `indexingRunId` into every downstream
call, and the cache key contains it. There is no runtime assertion
because no code path can assemble a mixed view.

### D-3 — The cached graph carries module file membership

**Spec.** Implies module detail could be re-queried by path prefix.

**Decision.** `DependencyGraph` carries `filePathsByModule`.

**Why.** A path-prefix query cannot reproduce the grouping exactly —
`moduleKeyFor('src/x.ts')` is `src`, which also prefix-matches every
file under `src/`, so a prefix query would over-collect. Serving
module detail from the same derived structure guarantees the detail
and the inventory agree.

### D-4 — Non-import relationship counts are repository-level

**Spec.** RS-2 requires the other five types to be counted and
reported, without fixing a granularity.

**Decision.** They are reported per repository, not per module.

**Why.** Their `fromSymbol` is the narrowest enclosing symbol rather
than the file module symbol, so per-module attribution would require
loading every symbol id for the revision — a cost AD-6 exists to
avoid.

### D-5 — Module keys travel as query parameters

**Spec.** Describes module-scoped reads without fixing the URL shape.

**Decision.** `GET .../dependency-map/module?key=` and
`GET .../dependency-map/evidence?from=&to=`.

**Why.** Module keys are folder paths containing slashes, which would
otherwise break path-parameter routing. Values are validated DTOs.

### D-6 — Target resolution is a new derivation-time capability

**Spec.** AD-5 requires the ability to attribute a relationship
target to a file, explicitly "a requirement on data, not a mandate
for a particular stage, schema, or algorithm".

**Decision.** `TargetResolverService` resolves at derivation time
from the source file path, the raw specifier already stored in
`SymbolRelation.targetFilePath`, and the `RepositoryFile` paths of
the same revision. It reads no source text and adds no parsing stage.

**Effect.** The unresolved reason taxonomy
(`NO_TARGET_PATH_RECORDED`, `RELATIVE_PATH_NOT_FOUND`,
`ALIAS_UNRESOLVED`, `AMBIGUOUS_MATCH`, `TARGET_MODULE_EXCLUDED`) is
part of the response, so an unresolved relationship states why rather
than disappearing (EV-5). Per-language coverage and the alias
heuristic are documented in
[docs/features/dependency-mapping.md](../../features/dependency-mapping.md).

### D-7 — Import rows are deduplicated twice

**Spec.** RS-6 requires evidence counts to be meaningful.

**Decision.** Deduplication happens at the database (`distinct` on
`fromSymbolId`, `targetFilePath`, `targetQualifiedName`) and again in
memory, keyed by relation type, source file, and either the observed
target path or the target name.

**Why.** One JavaScript or TypeScript import statement emits one
`SymbolRelation` row per imported identifier, so a raw count would
inflate the strength of a dependency. Keeping the target **name** in
the in-memory key preserves distinct PHP and plain-Python targets,
which have no path to key on (EV-5).
