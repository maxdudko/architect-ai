# System Overview

- Status: Draft
- Version: 1.0
- Product: Architect AI
- Phase: 2 — Architecture Explorer
- Parent specification: [Phase 2 — Architecture Explorer](../spec.md)
- Depends on: [Dependency Mapping](../dependency-mapping/spec.md)
- Related: [Architecture Search](../architecture-search/spec.md)

## 0. Verification of existing representation

This specification is written against the implementation that
exists today. The following was verified before writing
requirements, and the requirements depend on it.

### 0.1 Symbols

Symbols are persisted as `CodeSymbol`
(`apps/api/prisma/schema.prisma`) with `repositoryId`,
`indexingRunId`, optional `fileId`, `filePath`, `type`
(`CodeSymbolType`), `name`, `qualifiedName`, `language`, line and
column spans, `exported`, `isAsync`, `isStatic`, `visibility`,
and an optional `parentSymbolId`.

`CodeSymbolType` contains `FUNCTION`, `CLASS`, `METHOD`,
`INTERFACE`, `ENUM`, `TYPE_ALIAS`, `VARIABLE`, `CONSTANT`,
`NAMESPACE`, `MODULE`. Each parsed file yields one `MODULE`
symbol whose `qualifiedName` is the repository-relative file
path (`createModuleSymbol` in
`apps/api/src/modules/code-intelligence/languages/ast-helpers.ts`).

`CodeSymbol` has no `workspaceId` column.

### 0.2 Relationships

Relationships are persisted as `SymbolRelation` with
`repositoryId`, `indexingRunId`, a required `fromSymbolId`, a
nullable `toSymbolId`, `relationType`, and nullable
`targetQualifiedName` and `targetFilePath`.

`SymbolRelationType` contains exactly `IMPORTS`, `EXPORTS`,
`EXTENDS`, `IMPLEMENTS`, `CALLS`, `USES`.

Rows are written inside the per-file parse callback of
`CodeIntelligenceParseService.parseRepository` using a
`symbolIdMap` scoped to the file being parsed, so `toSymbolId`
is populated only for same-file targets. Cross-file targets
survive only as unresolved text whose meaning differs by
language: a raw module specifier for JavaScript and TypeScript,
a dotted module name only for Python `from` imports, and nothing
at all for PHP imports or plain Python `import` statements.

`SymbolRelation` carries no confidence, resolution state, or
provenance field, and no `workspaceId`.

### 0.3 Repositories

`Repository` carries `workspaceId`, `provider`, `externalId`,
`owner`, `name`, `fullName`, `defaultBranch`, `status`
(`RepositoryStatus`), `lastIndexedAt`, `indexingError`, and
`deletedAt`.

Generation readiness is gated on status:
`PrismaOnboardingGuideStorage.validateRepositoryReady` resolves
the repository under `{ id, workspaceId, deletedAt: null }` and
throws unless `status === READY`.

### 0.4 Indexing revisions

`IndexingRun` carries `status` (`RUNNING`, `SUCCEEDED`,
`FAILED`), `trigger`, `branch`, `commitSha`, and per-run counts.
`RepositoryFile`, `CodeSymbol`, `SymbolRelation`, and `Chunk`
all carry `indexingRunId`.

`PrismaIndexedTopologyDataSource.loadLatest` resolves the newest
`SUCCEEDED` run itself and accepts no revision argument. It then
loads all non-ignored, non-binary, non-generated files, all
symbols, and all relations for that run with no result bound.

`Guide` and `GuideGenerationRun` both already carry
`sourceIndexingRunId` and `sourceCommitSha`, so revision
provenance for generated content already exists.

### 0.5 Source references

Three reference shapes exist: `CodeSymbolResponseDto`
(`filePath`, `startLine`, `endLine`, `name`, `qualifiedName`,
`type`, `language`), `RepositoryFileResponseDto` (`path`,
`language`, `lineCount`, and the `generated`, `ignored`,
`binary` flags), and `RetrievedChunkReference` (`chunkId`,
`repositoryId`, `filePath`, `symbolName`, `qualifiedName`,
`startLine`, `endLine`, `score`).

Generated guides do not persist structured citations. Instead,
`RetrievalBackedGuideGenerator.generate`
(`apps/api/src/modules/onboarding/generators/retrieval-backed-guide.generator.ts`)
stores an `evidencePaths` array plus `retrievalQuery`, provider,
model, `sourceIndexingRunId` and `sourceCommitSha` in the
guide's `metadata` JSON, and the prompt instructs the model to
cite repository-relative paths inline in the Markdown.

### 0.6 Existing generation pipeline

Verified properties of the living onboarding guide pipeline,
which is the infrastructure this feature is expected to reuse:

- `GuideType` contains exactly `EXECUTIVE_SUMMARY`,
  `PROJECT_OVERVIEW`, `FOLDER`, `MODULE`, `SERVICE`,
  `TECHNOLOGY_STACK`, `READING_ORDER`, `GLOSSARY`,
  `COMMON_PITFALLS`. There is no system or architecture overview
  type.
- `GuideGenerationTrigger` contains `INITIAL_INDEX`,
  `MANUAL_GENERATE`, `MANUAL_REGENERATE`, `REINDEX`.
- Requests are asynchronous. `OnboardingGuidesService.generateGuides`
  and `regenerateGuides` enqueue and return a run DTO with HTTP
  202; `OnboardingGuideWorkerService` consumes the job and calls
  `OnboardingGuideOrchestrator.execute(runId)`.
- `GuideGenerationRun` tracks `status`, `requestedTypes`,
  `totalGuideCount`, `completedGuideCount`, `error`, `errors`,
  and timestamps, and is polled by the web client.
- The orchestrator calls `IndexedTopologyAnalyzer.analyze`, builds
  a work list of `(generator, target)` pairs, generates every
  target, and only then calls `storage.replaceGuideSet`.
- `replaceGuideSet` upserts each guide and deletes other guides
  of the replaced types inside one `$transaction`, incrementing
  `generationVersion` on update. This is why a failed run leaves
  the previous guides readable and intact.
- `Guide` is unique on `[repositoryId, type, slug]`.
  `generationVersion` is a counter; no immutable history of
  prior versions is stored, as stated in `docs/Architecture.md`
  §5.7.
- Content is constrained by `GUIDE_TEMPLATE_CONTRACTS`
  (`apps/api/src/modules/onboarding/templates/guide-template.contract.ts`),
  which declares a title, an objective, and an ordered list of
  required H2 headings per type.
- `normalizeGuideMarkdown`
  (`apps/api/src/modules/onboarding/utils/guide-output.util.ts`)
  strips code fences, demotes unexpected H2s to H3, reassembles
  the document in the contract's heading order, and fills any
  missing section with the literal text
  `Unclear from indexed evidence.` So required structure is
  enforced after generation rather than trusted.
- `GuidePromptBuilder` supplies the topology as JSON metadata
  with `majorFolders`, `moduleCandidates` and `serviceCandidates`
  each sliced to 15, plus entry point hints, technology
  evidence, compact prior guide summaries, and focused retrieved
  evidence. Its system prompt already requires Markdown only,
  exact H2 headings, inline path citations, separation of fact
  from inference using "Likely" or "Unclear from indexed
  evidence", no unsupported runtime claims, and treating
  retrieved source as untrusted evidence rather than
  instructions.
- Generation uses `WorkspaceLlmResolver.resolve(workspaceId)` and
  the `LlmProvider` contract, so hosted and BYOK providers both
  work.

### 0.7 Verified concurrency and defaulting behavior

Three behaviors constrain how a new overview can be added:

- **Single active run per repository.** Both
  `OnboardingGuidesService.enqueueGeneration` and
  `OnboardingGuideQueueService.enqueue` call
  `findActiveGenerationRun(workspaceId, repositoryId)`, which
  matches any run with status `QUEUED` or `RUNNING` regardless of
  its requested types, and **return that run instead of
  enqueueing a new one**.
- **Requested types default to every type.**
  `OnboardingGuideQueueService.resolveTypes` falls back to
  `Object.values(GuideType)` when no types are supplied, which is
  what `enqueuePostIndexGeneration` does from
  `RepositoryIndexingWorkerService` after every successful index.
- **The registry throws on an unregistered type.**
  `GuideGeneratorRegistry.get` throws
  `No guide generator registered for <type>` when a requested
  type has no generator, and `OnboardingGuideOrchestrator.buildWork`
  calls it for every requested type.

Taken together: adding a member to `GuideType` without a
registered generator would make every post-index generation run
fail, because the default request set would include the new type.

### 0.8 Existing quota accounting

`OnboardingGuidesService.enqueueGeneration` calls
`usageService.assertWithinLimit(workspaceId, UsageMetric.GUIDE_GENERATIONS)`.

`UsageService.countUsed` counts `GUIDE_GENERATIONS` as the number
of `GuideGenerationRun` rows for the workspace in the current UTC
month, and `GUIDE_GENERATIONS` is in `BYOK_UNLIMITED_METRICS`, so
a workspace with an active BYOK provider has no cap.

Generation is limited to `OWNER`, `ADMIN`, `MEMBER`
(`GENERATE_ROLES` in `OnboardingGuidesController`) and rate
limited to 10 requests per 60 seconds; reading also admits
`VIEWER` (`READ_ROLES`).

### 0.9 Existing architecture prose and its evidence basis

`EXECUTIVE_SUMMARY` and `PROJECT_OVERVIEW` guides already claim
architectural content. Their contracts include headings such as
`Architecture Style`, `Architecture Overview`,
`Application and Request Flow`, `Data Flow`, `Entry Points`,
`Main Domains`, and `External Integrations`, and the `FOLDER`
contract includes `Dependencies Between Folders`.

Verified, however: the evidence behind that prose is folder
aggregates and semantically retrieved chunks. The topology
supplied to the prompt carries file, symbol and relation
_counts_ and a per-folder `relationCount` computed with
`startsWith` prefix matching on the unresolved `targetFilePath`.
No resolved module-to-module dependency edge is available to any
existing generator. Existing architecture prose is therefore not
backed by a dependency graph.

### 0.10 Existing web representation

`apps/web/src/entities/onboarding-guide.ts` declares `GuideType`
as a string union, and `GUIDE_TYPE_LABELS` in
`apps/web/src/features/onboarding/utils/guide-tree.ts` is an
exhaustive `Record<GuideType, string>` consumed by
`onboarding-guides-view.tsx` alongside a `GROUPS` array that
assigns types to navigation groups. Introducing a new type
requires updating these exhaustive structures.

## 1. Goal

Allow an authorized workspace member to obtain a high-level,
evidence-backed architecture overview of an indexed repository,
generated asynchronously, grounded in the module and dependency
model rather than in folder statistics and semantic similarity
alone, stamped with the indexing revision it describes, and
replaced only after a successful regeneration.

## 2. User problem

A newcomer or a senior engineer joining an unfamiliar system
needs one document that answers: what are the main parts of this
system, how do they depend on each other, what technologies does
it use, where are the boundaries, and what is uncertain.

The MVP produces architecture-flavoured prose already, but
verification established that this prose is generated from
folder aggregates and semantically retrieved chunks, with no
resolved dependency edges available to it. The result can read
as authoritative while resting on weaker evidence than its
wording implies.

Engineers also cannot tell which revision a description reflects
without inspecting metadata, and cannot tell which statements
are observed facts versus the model's inference.

## 3. Scope

In scope:

1. Generating an architecture overview on request for a
   repository in a state where generation is permitted.
2. Supplying architecture-aware context to generation:
   modules, their dependencies and dependents, confidence
   classification, unresolved relationship counts, technology
   evidence, and entry point hints.
3. Covering the content areas required by the parent
   specification: main modules, important dependencies,
   technologies and infrastructure, integration patterns,
   architectural boundaries, and limitations.
4. Enforcing required structure and explicit uncertainty in the
   produced document.
5. Persisting a current overview per repository, with a defined
   replacement policy that never discards a valid overview
   before a replacement succeeds.
6. Reading the current overview, including its revision
   provenance and generation status.
7. Requesting regeneration.
8. Reporting generation progress and failure.
9. Bounded context and bounded content for large repositories.
10. Empty, processing, partial, and error states.

Out of scope for this feature:

- Rendering the dependency graph, which Dependency Mapping owns.
- Answering ad-hoc questions, which Architecture Search owns.
- Deriving modules or dependencies. System Overview consumes
  that model and never produces a second one.

## 4. Non-goals

- Replacing or removing existing onboarding guide types.
- Writing documents back into the repository, for example a
  README or an architecture file.
- Storing an immutable history of past overviews, or diffing
  overviews across revisions.
- Automatic regeneration on a schedule or timer.
- Per-module documents, which the existing module guide covers.
- Cross-repository or workspace-level overviews.
- Architecture decision records or decision reasoning (Phase 3).
- Change impact analysis or risk scoring (Phase 4).
- Design review, recommendations, or compliance judgements
  (Phase 5).
- Member editing, annotation, or manual override of generated
  content.
- Introducing a second indexing pipeline, retrieval pipeline, or
  LLM abstraction.
- Guaranteeing that generated prose is free of inference; the
  requirement is that inference is labelled, not absent.

## 5. User stories

- **US-1.** As a workspace member, I request an architecture
  overview for a repository and the request is accepted without
  blocking, so that I can continue working while it is produced.
- **US-2.** As a workspace member, I can see that generation is
  queued or running and roughly how far along it is.
- **US-3.** As a workspace member, I read the overview and learn
  the repository's main modules and how they depend on each
  other.
- **US-4.** As a workspace member, I read which technologies and
  infrastructure the repository uses, with the evidence for each.
- **US-5.** As a workspace member, I read where the
  architectural boundaries and integration points are.
- **US-6.** As a workspace member, I read an explicit section
  about what could not be determined, so that I do not mistake
  silence for absence.
- **US-7.** As a workspace member, I can tell which statements
  are observed from indexed evidence and which are the model's
  inference.
- **US-8.** As a workspace member, I can see which indexing
  revision and commit the overview describes.
- **US-9.** As a workspace member, I can follow a cited path
  from the overview into the existing file, symbol, or
  dependency surfaces.
- **US-10.** As a workspace member, I request regeneration after
  the repository changed and keep reading the previous overview
  until the new one is ready.
- **US-11.** As a workspace member, if generation fails, I see
  why in understandable terms and my previous overview is still
  there.
- **US-12.** As a workspace member in a very large repository, I
  get an overview that summarizes and states what it summarized,
  rather than an exhaustive or truncated-looking document.

## 6. Functional requirements

### FR-1: Access

An authorized member of the workspace owning the repository can
read the overview and request generation.

Requesting generation is a generation operation and follows the
existing generation role model. Reading follows the existing
read model, which admits the read-only role.

### FR-2: Asynchronous generation

A generation request must be accepted without performing
generation inside the request. The system must create a tracked
generation unit and report its identity and status to the
caller.

Expensive model work must not block API requests.

### FR-3: Eligibility

Generation may only be requested for a repository in a state
where generated content is permitted, consistent with the
existing readiness rule that gates guide generation.

If the repository is not eligible, the request must be refused
with a stated reason and no generation unit may be left in a
misleading state.

### FR-4: Architecture-aware context

Generation must receive architecture-aware context derived from
the module and dependency model defined by Dependency Mapping,
including at minimum:

- the modules identified for the revision, with their inventory;
- directed dependencies and dependents between modules, with
  supporting relationship counts, contributing relationship
  types, and confidence classification;
- counts of unresolved relationships and their reasons;
- externally targeted relationships, summarized;
- technology evidence and entry point hints available from the
  indexing result.

Supplying only folder aggregates and semantically retrieved
chunks does not satisfy this requirement.

### FR-5: Supporting retrieval

Generation may additionally use existing retrieval for
explanatory source context. Retrieved context must never be used
to assert a dependency that the architecture model does not
support.

### FR-6: Required content areas

The overview must cover, where the available data supports it:

- main architectural modules;
- important module dependencies;
- technologies and infrastructure;
- major integration patterns;
- relevant architectural boundaries;
- limitations and uncertain conclusions.

Where the data does not support a content area, the overview must
say so explicitly rather than omitting the area silently.

### FR-7: Structure enforcement

The overview must conform to a declared document structure with
an ordered set of required sections, and conformance must be
enforced after generation rather than assumed from model
output.

Any required section the model did not produce must be present
and explicitly marked as not determinable from indexed evidence,
consistent with the existing normalization behavior.

### FR-8: Uncertainty labelling

The overview must distinguish observed statements from inferred
statements, and must carry an explicit limitations section.
Uncertainty wording must follow the existing convention already
required of generated guides.

### FR-9: Evidence citation

Statements about structure and technology must cite
repository-relative paths, and cited paths must exist in the
revision being described.

### FR-10: Current-overview persistence

The system must retain one current overview per repository.

A previous valid overview must remain readable throughout a
regeneration and must not be removed or invalidated until a
replacement has been produced successfully.

### FR-11: Replacement policy

Replacement must be all-or-nothing with respect to the overview:
either the new overview fully replaces the current one, or the
current one is left unchanged.

### FR-12: Regeneration

A member may request regeneration. The system must define and
apply a concurrency policy for overlapping requests, and must
not silently discard a regeneration request.

Verification established that the existing pipeline returns any
active generation run for the repository regardless of its
requested types. If that behavior is inherited, a request made
while an unrelated generation is active would never produce an
overview. The chosen policy must not have that outcome (Q-3).

### FR-13: Status and progress

The system must expose the status of the current or most recent
generation, including queued, running, succeeded and failed
states, progress where meaningful, and a failure reason when
failed.

### FR-14: Revision provenance

The overview must record and display the indexing revision and,
where available, the branch and commit it describes.

### FR-15: Staleness visibility

When the repository has a newer successful revision than the one
the current overview describes, the member must be able to tell
that the overview is out of date.

### FR-16: Quota and rate limiting

Overview generation is an AI generation operation. It must
consume the workspace's existing generation allowance and be
subject to request rate limiting, consistent with existing
generation endpoints.

No code path may provide unmetered generation (Q-4).

### FR-17: Bounded generation

The context supplied to generation and the content produced must
be bounded, and truncation or summarization must be explicit.

### FR-18: Non-interference

System Overview must not change existing behavior of repository
ingestion, indexing, chat, existing onboarding guide generation,
authentication, authorization, or usage accounting.

In particular, introducing the overview must not cause existing
post-index generation to fail or to silently begin producing
additional content. Verification identified two mechanisms that
make this a live risk: requested types default to every declared
type, and the generator registry throws for a declared type with
no registered generator (Q-1, Q-2).

### FR-19: Relationship to existing guides

The overview must not silently duplicate or contradict existing
architecture-flavoured guides. The product must make clear what
the overview is and how it differs from the existing executive
summary and project overview guides (Q-11).

## 7. Architecture and data requirements

These constrain required data, not implementation.

### AD-1: Consumer of the architecture model

System Overview consumes the module and dependency model
specified in `../dependency-mapping/spec.md`. It must not define
its own module grouping, dependency derivation, or confidence
classification.

If the architecture model is unavailable for a revision, the
overview must either be refused with a stated reason or generated
with the absence explicitly stated. It must not silently fall
back to folder statistics while presenting itself as
dependency-grounded (Q-8).

### AD-2: Reuse of existing infrastructure

The feature must reuse the existing asynchronous generation
infrastructure, the existing LLM provider abstraction including
workspace BYOK resolution, the existing retrieval boundary, the
existing authorization guards, and the existing usage
accounting.

Per parent specification §5, introducing parallel generation, LLM,
or indexing infrastructure requires a recorded architectural
decision.

### AD-3: Required conceptual entities

The following must be representable. Whether the overview reuses
the existing guide entities or gets its own is an implementation
decision (Q-1).

- **Overview document**: repository, workspace, revision,
  commit, title, structured Markdown content, a short summary,
  and generation metadata including provider and model.
- **Generation unit**: repository, workspace, trigger, status,
  progress, failure reason, the revision it targeted, and
  timestamps.
- **Evidence set**: the cited repository-relative paths and,
  where applicable, the structural findings and retrieved
  references that supported the content.

### AD-4: Tenancy

Because `CodeSymbol` and `SymbolRelation` carry no
`workspaceId`, all architecture data used for generation must be
reached only through a repository confirmed to belong to the
requesting workspace. The overview document itself must be
workspace-scoped.

### AD-5: Revision binding

One overview describes exactly one indexing revision. Modules,
dependencies, retrieval evidence, and cited paths used to produce
it must all come from that revision.

The revision must be selected explicitly and recorded, rather
than each part of the pipeline independently resolving "the
latest successful revision".

### AD-6: Bounded context assembly

Assembling generation context must not require loading the
entire file, symbol, and relation set of a repository without
bound. Verification established that the existing topology data
source does exactly that, and that behavior must not be
inherited at a larger scale.

### AD-7: Declared context budget

The MVP must declare a budget for the architecture facts and
retrieved evidence supplied to the provider, and truncation must
be explicit in the supplied context as well as in the produced
document, consistent with existing prompt behavior.

### AD-8: Output validation

Produced content must be validated before it is stored: required
structure enforced, and cited paths checked against the
revision. Content that fails validation must not replace a valid
current overview.

### AD-9: Language coverage

Structural coverage is limited to what the existing packs
extract for TypeScript, JavaScript, Python, and PHP. Other
languages, generated files, binaries, ignored files, and
unparsed manifests do not contribute structure, and the overview
must state that limitation.

## 8. Relationship semantics

Binding on both data and produced wording.

### RS-1: Static and syntactic only

All structural facts derive from static, syntax-level extraction
over one revision. The overview must never describe them as
runtime behavior, traffic, invocation frequency, or data flow
observed in production.

### RS-2: Relationship types

Only `IMPORTS`, `EXPORTS`, `EXTENDS`, `IMPLEMENTS`, `CALLS`,
`USES` exist. The overview must not invent relationship types.

### RS-3: Confidence classification

Structural claims must respect the confidence classification
defined by Dependency Mapping — resolved, unresolved, or
external — and the overview must not describe an unresolved or
external relationship as an internal module dependency.

### RS-4: Observed versus inferred

Observed statements and inferred statements must be
distinguishable in the produced document, using the existing
convention that marks likelihood and marks content that is
unclear from indexed evidence.

### RS-5: Similarity is never proof

Semantic similarity, retrieval rank, and retrieval score must
never be presented as evidence of a dependency, and must never
justify asserting a structural relationship. This restates
parent specification §4.4 as a constraint on generated content.

### RS-6: Known imprecision must not be overstated

The overview must not overstate precision beyond what extraction
supports: import relationships attach to a file's module symbol
rather than the using symbol; import target names are identifier
tokens taken from statement text and may include names that are
not imported symbols; `CALLS` and `USES` targets are bare names
attributed to the narrowest enclosing symbol by line range;
`EXTENDS` and `IMPLEMENTS` targets are bare type names with no
location.

### RS-7: Absence is not proof of absence

An absent relationship means none was observed in supported
languages in this revision. The overview must not present that
as proof of independence or isolation.

### RS-8: Technology and infrastructure claims

Verification established that technology detection is a set of
regular expressions matched against file paths, all of which
target manifest or configuration filenames, and that no marker
exists for any message broker, queue, or streaming platform.

Technology and integration statements must therefore be grounded
in manifest and configuration evidence or in cited source, and
marked as inferred where they are not. The overview must not
present an inventory of runtime infrastructure, brokers, or
deployment topology as established fact.

### RS-9: Architectural style claims

Statements about architectural style, boundaries, or patterns are
interpretations. They must be presented as such, with the
evidence that motivated them.

## 9. UI behavior

### UI-1: Entry point

The overview is reachable from the repository's Architecture
Explorer context, and its relationship to the existing guide
library must be unambiguous to the member (FR-19).

### UI-2: Reading

The overview is presented as structured, readable content with
its required sections, following the existing rendering
conventions used for generated Markdown documents.

### UI-3: Provenance display

The revision, and where available the branch and commit, are
displayed with the overview, together with when it was
generated.

### UI-4: Staleness indication

When a newer successful revision exists, the surface indicates
that the overview is out of date and offers regeneration to
members whose role permits it.

### UI-5: Generation controls

Members whose role permits generation can request generation and
regeneration. Members who may only read must not see actionable
generation controls.

### UI-6: Progress

Queued and running states are visible and distinguishable from a
missing overview, with progress where meaningful, following the
existing polling conventions used for generation runs.

### UI-7: Uncertainty is visible

Limitations and inferred content must be visible in the
rendered document, not hidden behind metadata.

### UI-8: Evidence navigation

Cited paths must be navigable into the existing file, symbol, or
dependency surfaces, preserving repository and revision context
and allowing return.

### UI-9: Bound disclosure

Where the overview summarized rather than enumerated, that must
be stated in the document and reflected in the surface.

### UI-10: Consistency with existing patterns

The surface follows existing web conventions: feature-scoped
modules with colocated components, hooks and services,
centralized API access, typed entity contracts, and existing
shared page, header, and empty-state primitives, per
`apps/web/src/ARCHITECTURE.md`.

If the overview is represented as a new document type, the
exhaustive label and grouping structures identified in §0.10
must be updated accordingly.

### UI-11: Read-only content

The rendered overview is read-only. No editing or annotation is
offered.

## 10. Empty, loading, and error states

### ST-1: No overview yet

If no overview exists, the surface must say so and offer
generation to members whose role permits it, rather than showing
an empty document.

### ST-2: Repository not eligible

If the repository has no successful indexing revision or is not
in an eligible state, the surface must explain that and point to
the repository's indexing state, and generation must not be
requestable.

### ST-3: Indexing in progress

If a rebuild is running and a previous overview exists, the
overview remains readable and labelled with the revision it
describes, with the rebuild indicated.

### ST-4: Queued or running

Queued and running states must be distinguishable from both a
missing overview and a completed one, and any previous overview
must remain readable throughout.

### ST-5: No architecture model

If modules or dependencies are unavailable for the revision, the
surface must state that the overview cannot be
dependency-grounded, and either refuse generation or clearly
mark the resulting document's reduced basis (AD-1).

### ST-6: Insufficient data

If the revision yields too little structure to support the
required content areas, the produced overview must state that
explicitly per FR-6 rather than presenting thin content as
complete.

### ST-7: Generation failure

On failure, the surface must present an understandable reason,
retain the previous overview, and offer retry where meaningful.

### ST-8: Invalid generated output

If produced content fails validation, it must not replace a
valid current overview, and the attempt must be reported as
failed.

### ST-9: Partial generation

A generation unit that ended without producing a complete valid
document must not leave a partially replaced overview.

### ST-10: Quota exhausted

If the workspace generation allowance is exhausted, the request
must be refused with a clear limit message and no generation
performed.

### ST-11: Provider unavailable or misconfigured

If the resolved provider is unavailable or a workspace-owned key
is invalid, the failure must be reported without exposing key
material or provider internals.

### ST-12: Errors are sanitized

No state may expose secrets, tokens, credentials, absolute host
paths, prompts, stack traces, or provider internals.

## 11. Large graph and large context behavior

### LG-1: Summarize, never silently truncate

For large repositories the overview must describe the most
significant modules and dependencies and state, in aggregate
terms, what it did not enumerate.

### LG-2: Bounded structural context

The number of modules, dependencies and dependents supplied to
generation must be bounded and ordered deterministically by a
stated significance measure.

### LG-3: Bounded retrieval

Supporting retrieval must use a bounded result count consistent
with existing generation usage.

### LG-4: Declared budget

The MVP must declare concrete values for the structural context
bounds, the retrieval bound, and the total context size. Exact
values are an open question (Q-7), but they must be fixed and
documented.

### LG-5: Bounded document length

The produced document must have a bounded length so that it
remains readable and storable, and the bound must not be reached
by silently dropping a required section.

### LG-6: Non-blocking

Generation must run outside the request path and must not block
unrelated API requests.

### LG-7: Cost proportionality

Producing one overview must not require work proportional to the
product of module count and relationship count.

## 12. Source and evidence requirements

### EV-1: Structural claims require evidence

Every structural claim in the overview must be traceable to
indexed evidence: the modules involved and at least one
repository-relative path.

### EV-2: Evidence content

Recorded evidence must identify the repository, the file paths
cited, and where available line ranges and symbol
identification, together with the revision it came from.

The MVP must adopt one consistent reference shape across Phase 2
rather than introducing a fourth (Q-6).

### EV-3: Cited paths must exist

Every path cited in the produced document must exist in the
revision being described. Fabricated paths must be treated as a
validation failure per AD-8.

### EV-4: Evidence is not invented

Evidence items must be derived from indexed data. Evidence must
not be accepted from model output.

### EV-5: Distinguishable evidence origin

Where the overview relies on structural findings versus retrieved
source context, that distinction must be preserved in the
recorded evidence.

### EV-6: No secret exposure

Files excluded from indexing remain excluded from generation
context and from the produced document. Repository secrets must
not enter the provider context or the overview.

### EV-7: Evidence is verifiable

Cited evidence must be reachable in the existing browsing
surfaces so a member can check it.

## 13. Index revision behavior

### IR-1: Explicit selection and recording

Generation targets one explicitly selected successful revision,
and the produced overview records it.

### IR-2: Default revision

By default the most recent successful revision at the time
generation starts is used.

### IR-3: No mixing

One overview must not combine architecture data, retrieval
evidence, or cited paths from different revisions.

### IR-4: Revision change during generation

If a newer successful revision appears while generation is
running, the produced overview must remain consistent with the
revision it started from and must record that revision. It must
not be presented as describing the newer revision.

### IR-5: During rebuild

A rebuild must not remove or invalidate the current overview.
The overview remains readable, labelled with the revision it
describes.

### IR-6: After a failed rebuild

A failed rebuild must not affect the current overview.

### IR-7: Staleness

An overview describing a superseded revision remains readable
and must be identifiable as describing that revision (FR-15).

### IR-8: Revision no longer available

If the revision an overview describes is gone, the overview must
remain identifiable as historical and must not be presented as
current.

## 14. Security and isolation requirements

### SEC-1: Workspace boundary

The overview, its generation units, its evidence, and all
architecture data used to produce it must be scoped to the
owning workspace. No data from another workspace may be exposed,
including through module names, counts, paths, or error
messages.

### SEC-2: Repository boundary

Repository membership in the requesting workspace must be
confirmed before reading the overview or requesting generation,
consistent with the existing distinction between validating
repository membership and performing a live provider access
check for generation and mutation.

### SEC-3: Role model

Reading follows the existing read role model, which admits the
read-only role. Requesting generation follows the existing
generation role model. No new privileged operation is
introduced.

### SEC-4: Retrieval isolation

Supporting retrieval must apply the existing workspace,
repository, and revision filters.

### SEC-5: No secrets in provider context

Repository secrets, credentials, tokens, and provider keys must
never be placed in the generation context or the produced
document.

### SEC-6: Untrusted repository content

Repository content supplied as generation context is untrusted
input. Instructions embedded in source code or comments must not
change the system's behavior, expand its scope beyond the
authorized repository, alter the required document structure, or
cause unsupported claims to be presented as fact. The existing
prompt already states this requirement; it must be preserved and
verified.

### SEC-7: Enumeration resistance

Identifiers that do not resolve within the requesting workspace
must not be distinguishable from identifiers that do not exist.

### SEC-8: Error hygiene

Errors must not expose secrets, tokens, absolute host paths,
prompts, stack traces, or provider internals.

### SEC-9: Accounting integrity

Overview generation must be metered. No path may provide
unmetered AI generation.

## 15. Acceptance criteria

- **AC-1.** Given a ready repository and an authorized member,
  when the member requests an overview, then the system accepts
  the request without performing generation inline, creates a
  tracked generation unit, and reports its status.
- **AC-2.** Given an accepted request, when generation completes
  successfully, then an overview exists containing the required
  content areas and recording the indexing revision it
  describes.
- **AC-3.** Given a completed overview, when it is examined,
  then every required section is present, and any section not
  supported by evidence is explicitly marked as not determinable
  from indexed evidence.
- **AC-4.** Given a completed overview, when its structural
  statements are examined, then they are consistent with the
  module and dependency model for the same revision, and no
  unresolved or external relationship is described as an
  internal module dependency.
- **AC-5.** Given a completed overview, when its cited paths are
  checked, then each exists in the revision being described.
- **AC-6.** Given an existing valid overview, when regeneration
  is requested, then the previous overview remains readable
  throughout and is replaced only after the new one is produced
  successfully.
- **AC-7.** Given a generation failure, when the member views
  the surface, then the previous valid overview is still
  readable, the failure reason is understandable, and no secrets
  or internal details are exposed.
- **AC-8.** Given produced content that fails validation, when
  the run finishes, then the current overview is unchanged and
  the run is reported as failed.
- **AC-9.** Given a repository with no successful indexing
  revision, when a member opens the surface, then an unavailable
  state is shown and generation cannot be requested.
- **AC-10.** Given a repository whose revision yields no usable
  architecture model, when an overview is requested, then the
  system either refuses with a stated reason or produces a
  document that explicitly states its reduced basis, and never
  presents folder statistics as dependency evidence.
- **AC-11.** Given a repository with a newer successful revision
  than the overview describes, when a member views the overview,
  then the surface indicates that it is out of date.
- **AC-12.** Given a workspace whose generation allowance is
  exhausted, when a member requests an overview, then the
  request is refused with a clear limit message and no
  generation is performed.
- **AC-13.** Given a repository in workspace A, when a member of
  workspace B requests or reads its overview, then the request
  is rejected and no overview content, module names, or paths
  are exposed.
- **AC-14.** Given a member with read-only permissions, when
  they open the surface, then they can read the overview and
  cannot request generation.
- **AC-15.** Given repository content containing instructions
  aimed at the model, when an overview is generated, then the
  required structure, scope, authorization, and evidence rules
  are unchanged.
- **AC-16.** Given a newer successful revision appearing during
  generation, when the overview is stored, then it records the
  revision generation started from and is not presented as
  describing the newer one.
- **AC-17.** Given a large repository, when the overview is
  produced, then it is bounded, states what it summarized
  instead of enumerated, and retains every required section.
- **AC-18.** After implementation, existing post-index and
  manual onboarding guide generation continues to succeed
  unchanged, and existing repository ingestion, chat, usage
  limit, authentication, and workspace isolation tests continue
  to pass.

## 16. Edge cases

- Repository with a successful revision but no modules.
- Repository with modules but no resolvable dependencies, for
  example a PHP-only repository whose import targets carry no
  path information.
- Python repository using only plain `import` statements.
- Repository with exactly one module, or one file.
- Repository whose every file is excluded by grouping rules.
- Repository containing only unsupported languages.
- Repository containing only manifests.
- Monorepo producing either one oversized module or hundreds of
  tiny ones.
- Repository with hundreds of modules and a dense dependency
  graph.
- Repository whose dependency graph is entirely cyclic.
- Overview requested while an unrelated generation is already
  active for the same repository.
- Overview requested twice in quick succession.
- Overview requested while a reindex is running.
- Reindex completing between context assembly and storage.
- Two rebuilds completing during one generation.
- Repository disconnected or soft-deleted mid-generation.
- Workspace switching from hosted AI to a workspace-owned key
  mid-generation.
- Provider returning empty content.
- Provider returning JSON, or content wrapped in a code fence,
  instead of the required Markdown structure.
- Provider returning only some required sections, or extra
  sections.
- Provider returning fabricated file paths.
- Provider returning content far exceeding the length bound.
- Provider failing partway through a multi-step generation.
- Worker restarting while a generation unit is running.
- Generation unit that becomes stalled and never completes.
- Member's role changing while generation is running.
- Overview retained after the revision it describes is deleted.
- Repository whose status is ready but whose latest run recorded
  a rebuild failure.
- Existing executive summary and project overview guides
  disagreeing with the new overview.

## 17. Definition of done

- Overview generation is asynchronous, tracked, and observable.
- Generation context is architecture-aware and derived from the
  Dependency Mapping model.
- The produced document covers the required content areas, has
  enforced structure, labels inference, and states limitations.
- Cited paths are validated against the revision.
- Current-overview persistence and safe replacement are
  implemented and verified.
- Revision provenance and staleness visibility are implemented.
- Context and document bounds are implemented and documented.
- Workspace isolation and generation metering are verified.
- Existing post-index and manual guide generation are verified
  unchanged.
- All acceptance criteria in section 15 are verified by
  automated tests.
- Known limitations are documented.
- Deviations from this specification are recorded in
  `../decisions.md`.
