# Dependency Mapping

- Status: Draft
- Version: 1.0
- Product: Architect AI
- Phase: 2 — Architecture Explorer
- Parent specification: [Phase 2 — Architecture Explorer](../spec.md)

## 0. Verification of existing representation

This specification is written against the implementation that
exists today. The following was verified in the codebase before
writing requirements, and the requirements below depend on it.

### 0.1 Symbols

Symbols are persisted as `CodeSymbol`
(`apps/api/prisma/schema.prisma`). Each row carries
`repositoryId`, `indexingRunId`, optional `fileId`, `filePath`,
`type` (`CodeSymbolType`), `name`, `qualifiedName`, `language`,
line and column spans, `exported`, `isAsync`, `isStatic`,
`visibility`, and an optional `parentSymbolId` self-reference.

`CodeSymbolType` contains `FUNCTION`, `CLASS`, `METHOD`,
`INTERFACE`, `ENUM`, `TYPE_ALIAS`, `VARIABLE`, `CONSTANT`,
`NAMESPACE`, and `MODULE`.

Every parsed file produces exactly one `MODULE` symbol whose
`qualifiedName` is the repository-relative file path
(`createModuleSymbol` in
`apps/api/src/modules/code-intelligence/languages/ast-helpers.ts`).
Nested symbols receive dot-joined qualified names derived from
their parent.

`CodeSymbol` has **no** `workspaceId` column. Tenant scoping is
only possible through `Repository.workspaceId`.

### 0.2 Relationships

Relationships are persisted as `SymbolRelation`
(`apps/api/prisma/schema.prisma`) with `repositoryId`,
`indexingRunId`, a required `fromSymbolId`, a **nullable**
`toSymbolId`, `relationType`, and two nullable text fields
`targetQualifiedName` and `targetFilePath`.

`SymbolRelationType` contains exactly `IMPORTS`, `EXPORTS`,
`EXTENDS`, `IMPLEMENTS`, `CALLS`, and `USES`. No other
relationship type exists.

Relationship rows are written inside the per-file parse callback
of `CodeIntelligenceParseService.parseRepository`
(`apps/api/src/modules/code-intelligence/extractors/code-intelligence-parse.service.ts`)
using a `symbolIdMap` that only contains symbols from the file
currently being parsed. Consequently `toSymbolId` is populated
**only** when source and target are in the same file. Every
cross-file relationship has `toSymbolId = null` and survives
only as unresolved text.

`SymbolRelation` has no field expressing confidence, resolution
state, or provenance, and no `workspaceId` column.

Relationships are currently written but never read by any
controller or service. The only reader in the codebase is
`PrismaIndexedTopologyDataSource.loadLatest`
(`apps/api/src/modules/onboarding/guides/prisma-indexed-topology-data-source.ts`),
which consumes them for onboarding guide generation.

### 0.3 Repositories

Repositories are persisted as `Repository` with `workspaceId`,
`provider`, `externalId`, `owner`, `name`, `fullName`,
`defaultBranch`, `status` (`RepositoryStatus`), `lastIndexedAt`,
`indexingError`, and `deletedAt`.

`RepositoryStatus` is `PENDING`, `CLONING`, `PARSING`,
`CHUNKING`, `EMBEDDING`, `READY`, or `FAILED`. A repository
being rebuilt moves back through the processing statuses while
its previous successful index stays readable.

### 0.4 Indexing revisions

Revisions are persisted as `IndexingRun` with `status`
(`RUNNING`, `SUCCEEDED`, `FAILED`), `trigger`, `branch`,
`commitSha`, and per-run counts. `RepositoryFile`,
`CodeSymbol`, `SymbolRelation`, and `Chunk` all carry
`indexingRunId`.

Existing read paths resolve the current revision themselves.
`RepositoriesRepository.listCurrentCodeSymbols` and
`listCurrentRepositoryFiles`
(`apps/api/src/repositories/repositories.repository.ts`) each
call `getLatestSucceededIndexingRunId(repositoryId)`
independently and return an empty list when no successful run
exists. `PrismaIndexedTopologyDataSource.loadLatest` performs
its own equivalent lookup and accepts no revision argument.

### 0.5 Source references

Two source-reference shapes already exist and are already
rendered by the web application:

- `CodeSymbolResponseDto`
  (`apps/api/src/repositories/dto/code-symbol-response.dto.ts`):
  `filePath`, `startLine`, `endLine`, `name`, `qualifiedName`,
  `type`, `language`.
- `RepositoryFileResponseDto`
  (`apps/api/src/repositories/dto/repository-file-response.dto.ts`):
  `path`, `language`, `lineCount`, and the `generated`,
  `ignored`, `binary` flags.

Retrieval and generated content use a third shape,
`RetrievedChunkReference`
(`apps/api/src/modules/retrieval/types/retrieved-context.type.ts`):
`chunkId`, `repositoryId`, `filePath`, `symbolName`,
`qualifiedName`, `startLine`, `endLine`, `score`.

### 0.6 Existing module grouping precedent

`IndexedTopologyAnalyzer`
(`apps/api/src/modules/onboarding/guides/indexed-topology-analyzer.ts`)
already derives `moduleCandidates` from indexed files: it groups
files by a folder prefix of at most two path segments, excludes
paths matching `test|spec|fixture|vendor|generated|dist|build|node_modules`,
requires at least two files per group, boosts groups containing a
`MODULE`-typed symbol or a symbol whose name ends in `Module`,
and caps the result. It computes a per-folder `relationCount`
but never produces directed folder-to-folder edges.

## 1. Goal

Allow an authorized workspace member to understand how the
modules of an indexed repository depend on each other, by
exploring a bounded, evidence-backed dependency view derived
from the existing code intelligence data.

Dependency Mapping is the structural foundation of Phase 2. It
owns the module grouping and the dependency relationships that
Architecture Search and System Overview consume.

## 2. User problem

A new or rotating engineer can already browse files, browse
symbols, chat about the repository, and read onboarding guides.
None of these answer structural questions:

- Which logical parts does this repository consist of?
- Which parts does a given part depend on?
- Which parts would be affected if a given part changed?
- Where are the architectural boundaries?
- Which of these connections are actually proven by the code,
  and which are guesses?

Today the only way to answer these is to read import statements
file by file. The relationship data needed to answer them is
already extracted and stored, but is not readable through any
product surface.

## 3. Scope

In scope:

1. A module-level dependency view for a single repository that
   has a usable indexing result.
2. Deterministic grouping of indexed files into modules, with
   documented and inspectable grouping rules.
3. Directed dependency relationships between modules, derived
   from existing extracted relationships.
4. Selecting a module and viewing its direct dependencies and
   direct dependents.
5. Module metadata sufficient to judge size and significance.
6. Navigation from a module, and from a dependency
   relationship, to the underlying source evidence.
7. Explicit representation of relationship confidence, including
   relationships that could not be resolved.
8. Bounded behavior for repositories whose graph is too large to
   display usefully.
9. Identification of the indexing revision the view is derived
   from.
10. Empty, processing, partial, and error states.

Out of scope for this feature (covered elsewhere in Phase 2 or
later phases):

- Architecture-oriented natural language search
  (see `../architecture-search/spec.md`).
- Generated architecture prose or summaries
  (see `../system-overview/spec.md`).
- Any LLM involvement in producing the dependency view.

## 4. Non-goals

- Reconstructing a runtime or complete call graph.
- Cross-repository or workspace-wide dependency graphs.
- Dependency graphs of external packages or third-party
  libraries as first-class nodes.
- Detecting microservice boundaries with guaranteed accuracy.
- Change impact prediction, blast-radius scoring, or test
  recommendations (Phase 4).
- Ownership, team, or contributor mapping.
- Cycle-breaking advice, refactoring proposals, or architectural
  compliance judgements (Phase 5).
- Editing, annotating, or manually overriding the derived graph.
- Persisting a history of graphs across revisions, or diffing
  two revisions.
- Adding new language packs, or improving symbol extraction
  quality beyond what dependency resolution requires.
- Exporting the graph to external diagram formats.

## 5. User stories

- **US-1.** As a workspace member, I open Dependency Mapping for
  a repository and see the modules that make up the repository,
  so that I can orient myself before reading code.
- **US-2.** As a workspace member, I select a module and see
  which modules it depends on, so that I understand what it
  relies on.
- **US-3.** As a workspace member, I select a module and see
  which modules depend on it, so that I understand who would be
  affected by changing it.
- **US-4.** As a workspace member, I inspect a module and see
  which files and notable symbols it contains, so that I can
  confirm the grouping is meaningful.
- **US-5.** As a workspace member, I inspect a dependency
  between two modules and see the specific source locations that
  produced it, so that I can verify it rather than trust it.
- **US-6.** As a workspace member, I can tell which displayed
  relationships are directly proven by indexed code and which
  are unresolved, so that I do not act on a false connection.
- **US-7.** As a workspace member, I can see which indexing
  revision and commit the view reflects, so that I know whether
  it matches the code I am reading.
- **US-8.** As a workspace member working in a very large
  repository, I still get a usable view rather than an
  unreadable or failing one.
- **US-9.** As a workspace member whose repository has no usable
  relationships, I see an explanation of why the view is empty
  rather than a misleading empty diagram.
- **US-10.** As a workspace member, I can move from a module or
  a dependency into the existing file and symbol browsing
  surfaces without losing my place.

## 6. Functional requirements

### FR-1: Access

An authorized member of the workspace that owns the repository
can open Dependency Mapping for that repository.

Access follows the same authorization model as existing indexed
content reading: workspace membership and role, not per-user
provider access. All workspace roles that can currently read
indexed files and symbols, including the read-only role, can
read the dependency view.

### FR-2: Module identification

The system groups the indexed files of one indexing revision
into modules.

Requirements:

- Grouping must be deterministic: the same revision must always
  produce the same modules.
- Grouping must be derived only from data available in the
  existing indexing result.
- The supported grouping rules must be documented and stated in
  the product surface, including their limitations.
- Files excluded from grouping must be excluded for a stated
  reason.
- Each module must expose a stable identifier within a revision,
  a human-readable name, and the path or prefix it represents.
- A module must never contain files from more than one
  repository or more than one indexing revision.

The feature must not claim that derived modules correspond to
deployment units, packages, or services.

### FR-3: Module inventory

For each module the system must expose:

- name and represented path;
- number of indexed files;
- number of indexed symbols;
- languages present;
- a count of outgoing dependency relationships;
- a count of incoming dependency relationships;
- whether the module was truncated for display.

### FR-4: Dependency derivation

The system must derive directed module-to-module dependency
relationships from existing extracted relationships.

Requirements:

- A dependency is directed: a source module depends on a target
  module.
- A dependency must aggregate all underlying relationships that
  connect the two modules in that direction.
- A dependency must record how many underlying relationships
  support it.
- A dependency must record which relationship types contribute
  to it.
- A dependency must record its confidence as defined in
  section 8.
- A relationship whose target cannot be attributed to a module
  in the same repository must not produce a module dependency.
  It must instead be reported as unresolved, as defined in FR-6.
- Relationships within a single module must not appear as module
  dependencies, but may be counted as module-internal activity.

### FR-5: Module selection, dependencies and dependents

When a member selects a module, the system must present:

- the module's direct dependencies, each with the supporting
  relationship count, contributing relationship types, and
  confidence;
- the module's direct dependents, with the same information;
- the module's inventory as defined in FR-3;
- access to the module's files and notable symbols;
- access to source evidence as defined in section 12.

Only direct dependencies and direct dependents are required.
Transitive reachability is not required.

### FR-6: Unresolved relationships

Relationships that exist in the indexing result but cannot be
attributed to a target module must be surfaced as a distinct,
countable category rather than silently dropped.

For each module the system must be able to report:

- how many outgoing relationships could not be resolved;
- what the unresolved targets were named;
- why resolution was not possible, at the level of a stated
  category rather than a stack trace.

Unresolved relationships must never be rendered as if they were
module dependencies.

### FR-7: Externally targeted relationships

Relationships whose target is identifiable as something outside
the repository must be distinguished from relationships that are
simply unresolved.

Such targets must not become modules in the graph. They may be
summarized per module as external dependencies, with the name
observed in source.

### FR-8: Hierarchical exploration

The member must be able to move from a repository-level view to
a module-level view to module detail to source evidence, and
back, without losing the selected repository or revision
context.

A flat graph containing every symbol in the repository is not
required and must not be the default view.

### FR-9: Bounded results

Every list and graph the feature returns must be bounded. The
feature must not offer an unbounded "show everything" mode for
modules, dependencies, dependents, files, symbols, or evidence
items.

When a result is bounded, the surface must state that it is
bounded and what the bound was.

### FR-10: Revision identification

Every dependency view must identify the indexing revision and,
where available, the branch and commit it was derived from.

### FR-11: Consistency within a view

A single dependency view must be derived from exactly one
indexing revision. Modules, dependencies, dependents, metadata,
and evidence presented together must all belong to that same
revision.

### FR-12: Interaction with existing features

Dependency Mapping must not change the behavior of repository
ingestion, indexing, repository or workspace chat, onboarding
guide generation, authentication, or workspace isolation.

Dependency Mapping must not require re-indexing a repository
that already has a successful indexing result in order to
display a view, unless the requirements of section 8 cannot be
met from stored data, in which case the limitation must be
stated to the user.

## 7. Architecture and data requirements

These are requirements on the data the feature needs, not on how
it is stored or computed.

### AD-1: Derived from existing code intelligence

The dependency view must be derived from the existing indexing
result: `RepositoryFile`, `CodeSymbol`, and `SymbolRelation`
rows belonging to one `IndexingRun`.

The feature must not introduce a second code parsing pipeline, a
second indexing pipeline, or a second source of truth for
symbols and relationships.

### AD-2: Required conceptual entities

The feature requires the following concepts to be
representable. Whether they are persisted or derived on demand
is an implementation decision (see Q-1).

- **Module node**: repository, indexing revision, stable key,
  display name, represented path, file membership, and inventory
  counts.
- **Module dependency**: repository, indexing revision, source
  module, target module, contributing relationship types,
  supporting relationship count, and confidence.
- **Supporting evidence item**: a reference to the underlying
  source location that produced a dependency, as defined in
  section 12.
- **Unresolved relationship record**: source module, observed
  target name, relationship type, and unresolved reason.

### AD-3: Tenancy

Because `CodeSymbol` and `SymbolRelation` carry no
`workspaceId`, every module, dependency, evidence item, and
unresolved record must be reachable only through a repository
that has been confirmed to belong to the requesting workspace.

### AD-4: Revision binding

Every entity in AD-2 must be bound to a single indexing
revision. No entity may combine data from two revisions.

The revision used for a view must be selected explicitly and
reported, rather than each part of the view independently
resolving "the latest successful revision".

### AD-5: Relationship target attribution

The feature requires the ability to attribute a relationship
target to a repository file, in order to attribute it to a
module.

Verification established that this attribution is not available
in stored data today:

- `toSymbolId` is populated only for same-file targets, so it
  cannot carry a cross-module dependency.
- `targetFilePath` is not a repository file path. It holds a
  raw module specifier for JavaScript and TypeScript, a dotted
  module name only for Python `from` imports, and nothing at all
  for PHP imports or plain Python `import` statements.
- `targetQualifiedName` holds an identifier name observed in
  source, not a location.

The feature therefore requires a target attribution capability
that maps an observed target to a repository file within the
same revision, or reports that it could not. This capability
must produce, for every attempted attribution, either a
repository file in that revision or a stated unresolved reason.

This is the minimum new capability the requirements demand. It
is a requirement on data, not a mandate for a particular stage,
schema, or algorithm.

### AD-6: Bounded cost

Producing a dependency view must not require loading the entire
symbol and relationship set of a repository into memory without
limit, and must not perform work proportional to the product of
module count and relationship count.

### AD-7: Language coverage

Coverage is limited to the languages the existing packs support:
TypeScript, JavaScript, Python, and PHP, including their
variants. Files in other languages, generated files, binaries,
ignored files, and unparsed manifests are not required to
participate in the graph, and their exclusion must be stated.

## 8. Relationship semantics

This section defines what a displayed relationship means. It is
binding on both the data and the wording used in the product.

### RS-1: Static and syntactic only

All relationships originate from static, syntax-level
extraction. The feature must present them as observations about
source text, never as runtime behavior, invocation frequency, or
data flow.

### RS-2: Relationship types

Only the six existing types may be used: `IMPORTS`, `EXPORTS`,
`EXTENDS`, `IMPLEMENTS`, `CALLS`, `USES`. The feature must not
invent additional types, and must not silently merge types
without reporting which contributed.

### RS-3: Directionality

A module dependency points from the module containing the source
symbol to the module containing the target. `EXPORTS`
relationships describe a module's own surface and must not be
presented as a dependency on another module.

### RS-4: Confidence classification

Every dependency and every relationship shown must carry one of
the following classifications, and the classification must be
visible to the user:

- **Resolved** — the target was attributed to a specific
  repository file in the same revision. The dependency is
  supported by a concrete source location.
- **Unresolved** — a relationship was observed in source, but
  its target could not be attributed to a file in this
  repository. No dependency may be drawn.
- **External** — the target was identified as outside the
  repository. No internal dependency may be drawn.

The system must not upgrade a classification based on name
similarity, semantic similarity, or vector retrieval score.
Similarity is never proof of a dependency.

### RS-5: Reliability of the underlying signal

The requirements must reflect the following verified properties
of the extracted data, and the product must not overstate
precision:

- Import relationships are attached to the file's module
  symbol, not to the specific symbol that uses the import.
- `IMPORTS` targets are identifier tokens taken from the import
  statement text, so a single import statement can produce
  several target names, including names that are not imported
  symbols.
- `CALLS` and `USES` targets are extracted from expression text
  and attributed to the narrowest enclosing symbol by line
  range, so attribution is approximate and the target is a bare
  name.
- `EXTENDS` and `IMPLEMENTS` targets are bare type names with no
  location.

Given this, `IMPORTS` is the only relationship type that carries
any target-location signal today. Which types are permitted to
contribute to module dependencies in the MVP is an open question
(see Q-3), but any type admitted must satisfy RS-4.

### RS-6: Aggregation must be reversible

An aggregated module dependency must always be explainable by
enumerating at least a bounded sample of the underlying
relationships that produced it, each with its own source
location.

### RS-7: Stated limitations

Wherever relationships are shown, the surface must communicate
that the view reflects statically observed relationships in
supported languages for one indexing revision, and that absence
of a relationship is not proof that no runtime dependency
exists.

## 9. UI behavior

### UI-1: Entry point

Dependency Mapping is reachable from the repository context for
a repository with a usable indexing result. The Architecture
Explorer placeholder currently shown on the dashboard
(`apps/web/src/features/dashboard/components/dashboard-view.tsx`)
must lead to the real surface once available, or continue to
present itself as unavailable.

### UI-2: Repository-level view

The default view presents the repository's modules with enough
inventory information to judge significance, plus the revision
identification required by FR-10 and the limitations required by
RS-7.

### UI-3: Module selection

Selecting a module presents its dependencies, its dependents,
its inventory, and entry points into its files, symbols, and
evidence. The selected module must remain identifiable while the
member explores it.

### UI-4: Dependency inspection

A dependency can be inspected to reveal its contributing
relationship types, its supporting relationship count, its
confidence classification, and its source evidence.

### UI-5: Confidence is always visible

Confidence classification must be visible wherever a
relationship or dependency is displayed, not only in a detail
panel. Unresolved and external relationships must be visually
and textually distinguishable from resolved ones.

### UI-6: Navigation continuity

Moving into existing file or symbol browsing from Dependency
Mapping must preserve the repository and revision context, and
must allow returning to the previously selected module.

### UI-7: Bound disclosure

Whenever a displayed set was bounded, the surface must say so
and state what was omitted in aggregate terms.

### UI-8: Consistency with existing patterns

The surface must follow existing web application conventions:
feature-scoped modules with colocated components, hooks and
services, centralized API access, typed entity contracts, and
existing shared page, header, and empty-state primitives, as
described in `apps/web/src/ARCHITECTURE.md`.

### UI-9: Read-only

The surface is read-only. It must offer no mutation of modules,
dependencies, or groupings.

## 10. Empty, loading, and error states

### ST-1: No successful index

If the repository has never completed an indexing run, the
surface must state that architecture data is not yet available
and direct the member to the repository's indexing state. It
must not present an empty graph.

### ST-2: Indexing in progress

If a repository is being indexed or rebuilt, the surface must
state that clearly. If a previous successful revision exists,
the surface must remain usable from that revision and must
label it as the revision in use, consistent with the existing
behavior that a repository stays readable during rebuild.

### ST-3: Indexed but no modules

If the revision produced no groupable files, the surface must
explain that no modules could be identified and state the
grouping and exclusion rules that led to that outcome.

### ST-4: Modules but no dependencies

If modules exist but no dependency could be resolved, the
surface must show the modules and state that no dependencies
could be established. If unresolved relationships exist, their
count and reasons must be reported so the emptiness is
explained rather than implied to mean independence.

### ST-5: Loading

Loading must be distinguishable from empty. Partial results must
not be presented as complete.

### ST-6: Failure

Failures must produce an understandable state with a retry
affordance where retrying is meaningful. Messages must not
expose secrets, tokens, credentials, internal paths outside the
repository, stack traces, or provider internals.

### ST-7: Partial derivation

If part of a view could be produced and part could not, the
surface must present what is available and state what is
missing. It must not present a partial view as complete.

### ST-8: Stale revision

If the underlying data changes while a view is open, the surface
must be able to indicate that a newer revision exists rather
than mixing revisions in place.

## 11. Large graph behavior

### LG-1: Bounded by default

The initial view must be bounded to a number of modules that
remains readable, selected by a deterministic significance
ordering derived from module inventory. Remaining modules must
be reachable through focused exploration, search, or filtering,
not through an unbounded expansion.

### LG-2: Bounded neighborhoods

Dependencies and dependents of a selected module must be
bounded, ordered deterministically by supporting relationship
count, and disclosed as bounded when truncated.

### LG-3: Bounded evidence

Evidence lists must be bounded per dependency, as required by
RS-6.

### LG-4: Declared thresholds

The MVP must define explicit thresholds for the initial module
count, the per-module dependency and dependent counts, and the
per-dependency evidence count. Exact values are an open question
(see Q-5), but they must be fixed, documented, and not
user-overridable to unbounded values.

### LG-5: Density handling

For repositories whose graph exceeds the declared thresholds,
the surface must degrade to focused exploration rather than
rendering a dense unreadable graph, and must tell the member
that focused exploration is in effect.

### LG-6: No blocking work

Producing a view must not perform expensive work on a request in
a way that blocks unrelated requests, consistent with the
existing separation between the API process and the background
worker.

## 12. Source and evidence requirements

### EV-1: Evidence is required for resolved dependencies

Every dependency classified as resolved must be explainable by
at least one concrete source location.

### EV-2: Evidence content

An evidence item must identify the repository, the file path,
the line range where available, and the symbol name and
qualified name where available, together with the relationship
type it came from.

This matches the shapes already used by the product:
`CodeSymbolResponseDto`, `RepositoryFileResponseDto`, and
`RetrievedChunkReference`. The MVP must adopt one consistent
reference shape across Phase 2 features rather than introducing
a fourth (see Q-9).

### EV-3: Evidence provenance

Evidence must be traceable to the same indexing revision as the
view it explains.

### EV-4: Evidence is not generated

Evidence items must be derived from the indexing result. They
must not be produced, summarized, reworded, or inferred by an
LLM in this feature.

### EV-5: Unresolved relationships carry partial evidence

An unresolved relationship must still report where it was
observed — the source module, the source file, and the target
name as written in source — even though no target location
exists.

### EV-6: No secret exposure

Evidence must not surface repository secrets. Files already
excluded from indexing remain excluded from evidence.

## 13. Index revision behavior

### IR-1: Explicit revision selection

A view must be derived from one explicitly selected successful
indexing revision, and that revision must be reported with the
view.

### IR-2: Default revision

By default the view uses the repository's most recent successful
indexing revision.

### IR-3: No mixing

The system must not combine modules, dependencies, evidence, or
metadata from different revisions in one view. Verification
found that existing read paths each resolve "latest successful
run" independently, which permits straddling generations during
a rebuild; Dependency Mapping must not inherit that behavior.

### IR-4: Behavior during rebuild

While a new revision is being produced, the previous successful
revision remains the basis for the view, labeled as such.

### IR-5: Behavior after a new revision succeeds

Once a newer successful revision exists, new views use it.
Members viewing the older revision must be able to learn that a
newer one is available.

### IR-6: Behavior after a failed rebuild

A failed rebuild must not invalidate or corrupt the view derived
from the last successful revision.

### IR-7: Revision removal

If the revision a view depends on is no longer available, the
surface must fall back to a stated available revision or to the
appropriate empty state, and must not present orphaned data.

## 14. Security and isolation requirements

### SEC-1: Workspace boundary

All module, dependency, evidence, and unresolved-relationship
data must be scoped to the requesting workspace. A member of one
workspace must never receive architecture data for a repository
in another workspace, including through counts, names, file
paths, or error messages.

### SEC-2: Repository boundary

Requests must confirm that the repository belongs to the
requesting workspace before any architecture data is read,
consistent with the existing separation between validating
repository membership in a workspace and performing a live
provider access check for mutations.

### SEC-3: Role model

Reading the dependency view is available to the workspace roles
that can already read indexed content, including the read-only
role. The feature introduces no new privileged operation.

### SEC-4: Enumeration resistance

Identifiers that do not resolve within the requesting
workspace must not be distinguishable from identifiers that do
not exist.

### SEC-5: No cross-repository leakage

A view for one repository must contain only that repository's
data. External targets must be reported as names observed in
source, never resolved into another connected repository.

### SEC-6: Error hygiene

Error and limitation messages must not expose secrets, tokens,
credentials, absolute host paths, or internal infrastructure
details.

### SEC-7: Auditability

Access follows existing request logging and audit behavior. The
feature introduces no new secret material.

## 15. Acceptance criteria

- **AC-1.** Given an authorized workspace member and a
  repository with a successful indexing revision, when the
  member opens Dependency Mapping, then the system presents
  modules for the correct repository and reports the indexing
  revision used.
- **AC-2.** Given a repository whose revision yields resolvable
  relationships, when the member selects a module, then the
  system presents that module's direct dependencies and direct
  dependents, each with a supporting relationship count,
  contributing relationship types, and a confidence
  classification.
- **AC-3.** Given a displayed dependency classified as resolved,
  when the member inspects it, then the system presents at least
  one concrete source location containing a file path and, where
  available, a line range and symbol identification, drawn from
  the same revision.
- **AC-4.** Given relationships whose targets cannot be
  attributed to a module in the repository, when the member
  views the affected module, then the system reports them as
  unresolved with their observed target names and a stated
  reason, and draws no dependency for them.
- **AC-5.** Given a repository with a successful revision but no
  groupable files, when the member opens Dependency Mapping,
  then the system explains that no modules could be identified
  and states the grouping and exclusion rules, rather than
  showing an empty graph.
- **AC-6.** Given a repository with modules but no resolvable
  dependencies, when the member opens Dependency Mapping, then
  the system shows the modules, states that no dependencies
  could be established, and reports unresolved relationship
  counts where they exist.
- **AC-7.** Given a repository that has never completed an
  indexing run, when the member opens Dependency Mapping, then
  the system presents an unavailable state referencing the
  repository's indexing state.
- **AC-8.** Given a repository being rebuilt that has a previous
  successful revision, when the member opens Dependency Mapping,
  then the system presents the previous revision's view, labels
  the revision in use, and indicates that a rebuild is in
  progress.
- **AC-9.** Given a repository whose graph exceeds the declared
  thresholds, when the member opens Dependency Mapping, then the
  system presents a bounded view, states that it is bounded, and
  offers focused exploration instead of a dense full graph.
- **AC-10.** Given any displayed relationship, when the member
  views it, then its confidence classification is visible
  without opening a detail view, and unresolved and external
  relationships are distinguishable from resolved ones.
- **AC-11.** Given a repository in workspace A, when a member of
  workspace B requests its architecture data, then the request
  is rejected and no module names, dependency data, file paths,
  or counts are exposed.
- **AC-12.** Given a single dependency view, when its contents
  are examined, then every module, dependency, and evidence item
  in it belongs to the same indexing revision.
- **AC-13.** Given a failure while producing a view, when the
  member sees the result, then the surface presents an
  understandable state without exposing secrets or internal
  details.
- **AC-14.** After implementation, existing repository
  ingestion, chat, onboarding guide, authentication, and
  workspace isolation tests continue to pass.

## 16. Edge cases

- Repository with exactly one module, or one file.
- Repository whose every file is excluded by the grouping rules
  (tests only, generated only, vendored only).
- Repository containing only unsupported languages, so files are
  inventoried but no symbols or relationships exist.
- Repository containing only manifests, which are inventoried
  without parsing.
- Monorepo where the two-segment folder convention produces
  either one giant module or hundreds of tiny ones.
- Language mixture inside one module.
- Mutually dependent modules, and longer dependency cycles.
- Self-referential relationships within a module.
- Two modules connected in both directions.
- A module with many dependents and no dependencies, and the
  reverse.
- Files moved or renamed between revisions, changing module
  membership and stable keys.
- A revision in which relationships exist but every target is
  unresolved, for example a PHP-only repository where import
  targets carry no path information at all.
- Python repositories using only plain `import` statements,
  which carry no target path.
- JavaScript and TypeScript path aliases and index-file imports,
  where an observed specifier does not correspond directly to a
  file path.
- Import statements that produce multiple target names,
  including names that are not imported symbols.
- Duplicate relationships within a file that must not inflate
  supporting counts.
- Extremely large single files that dominate a module's symbol
  count.
- Repository disconnected, or soft-deleted, while a view is
  open.
- Reindex completing while a member is exploring a module.
- Two rebuilds completing in rapid succession.
- Repository whose status is `READY` but whose latest run
  recorded a rebuild failure in `indexingError`.
- Member's role changing while a view is open.
- Concurrent requests for the same repository from several
  members.

## 17. Open implementation questions

These must be resolved in `plan.md` or explicitly deferred and
recorded in `../decisions.md`.

- **Q-1.** Is the module and dependency model derived on demand
  per request, or produced once per indexing revision and
  stored? AD-6 and LG-6 constrain the answer; AD-2 does not
  prescribe it.
- **Q-2.** Where does target attribution (AD-5) happen — as part
  of producing an indexing revision, or as a derivation over a
  completed revision? If it happens during indexing, does an
  already-indexed repository need a new revision before it can
  be mapped, and how is that communicated under FR-12?
- **Q-3.** Which relationship types may contribute to module
  dependencies in the MVP, given that RS-5 establishes
  `IMPORTS` as the only type carrying target-location signal?
- **Q-4.** What exactly are the supported grouping rules
  (FR-2)? Are they the existing folder-prefix convention from
  `IndexedTopologyAnalyzer.moduleCandidates`, a language- or
  manifest-aware refinement, or both? What are the documented
  limitations?
- **Q-5.** What are the concrete threshold values required by
  LG-4?
- **Q-6.** What are the unresolved reason categories required by
  FR-6 and EV-5?
- **Q-7.** How are external targets recognized (FR-7), given
  that manifests are inventoried but not parsed?
- **Q-8.** How is a module's stable key defined so that it is
  stable within a revision and meaningful across revisions when
  files move?
- **Q-9.** Which single source reference shape does Phase 2
  adopt (EV-2), and does Dependency Mapping reuse the existing
  retrieval citation shape or the symbol and file response
  shapes?
- **Q-10.** How is the revision for a view selected and carried
  (IR-1, IR-3) so that no part of the view independently
  re-resolves "latest successful revision"?
- **Q-11.** How does the surface present the graph, and does
  presenting it require a rendering capability the web
  application does not currently have?
- **Q-12.** Does Dependency Mapping consume any usage or rate
  limit beyond existing request rate limiting, given that it
  performs no LLM work?
- **Q-13.** Which automated tests cover each acceptance
  criterion, and what fixture repository provides known
  resolvable cross-file relationships for AC-2, AC-3, and AC-4?
- **Q-14.** Do Architecture Search and System Overview consume
  this feature's module and dependency model directly, and if
  so what contract do they depend on?

## 18. Definition of done

- Modules, dependencies, dependents, confidence
  classifications, unresolved relationships, and evidence are
  available for repositories with a successful indexing
  revision.
- The supported grouping rules, supported relationship types,
  confidence classifications, and their limitations are
  documented.
- Bounded behavior is implemented and its thresholds documented.
- Revision identification and non-mixing are verified.
- Workspace isolation is verified.
- All acceptance criteria in section 15 are verified by
  automated tests.
- Existing MVP functionality remains functional.
- Deviations from this specification are recorded in
  `../decisions.md`.
