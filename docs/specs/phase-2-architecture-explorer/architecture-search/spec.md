# Architecture Search

- Status: Draft
- Version: 1.0
- Product: Architect AI
- Phase: 2 — Architecture Explorer
- Parent specification: [Phase 2 — Architecture Explorer](../spec.md)
- Depends on: [Dependency Mapping](../dependency-mapping/spec.md)

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

Symbols are readable today through
`GET workspaces/:id/repositories/:repositoryId/symbols`
(`RepositoriesController.listRepositorySymbols`), optionally
filtered by `filePath` and `type`. There is no name search, no
pagination, and no relationship traversal on that endpoint.

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
survive only as unresolved text, and that text differs by
language: a raw module specifier for JavaScript and TypeScript,
a dotted module name only for Python `from` imports, and nothing
at all for PHP imports or plain Python `import` statements.

`SymbolRelation` carries no confidence, resolution state, or
provenance field, and no `workspaceId`. No controller or service
reads it; the only reader is
`PrismaIndexedTopologyDataSource.loadLatest`.

### 0.3 Repositories

`Repository` carries `workspaceId`, `provider`, `externalId`,
`owner`, `name`, `fullName`, `defaultBranch`, `status`
(`RepositoryStatus`), `lastIndexedAt`, `indexingError`, and
`deletedAt`.

### 0.4 Indexing revisions

`IndexingRun` carries `status` (`RUNNING`, `SUCCEEDED`,
`FAILED`), `trigger`, `branch`, `commitSha`, and per-run counts.
`RepositoryFile`, `CodeSymbol`, `SymbolRelation`, and `Chunk`
all carry `indexingRunId`.

Read paths resolve the revision independently:
`RepositoriesRepository.listCurrentCodeSymbols` and
`listCurrentRepositoryFiles` each call
`getLatestSucceededIndexingRunId`, and
`PrismaIndexedTopologyDataSource.loadLatest` performs its own
lookup and accepts no revision argument.

Retrieval pins to live revisions separately:
`RetrievalService.retrieve`
(`apps/api/src/modules/retrieval/retrieval.service.ts`) resolves
run IDs through `ChunkDataSource.listLiveIndexingRunIds` when
none are supplied, and returns an empty context when there are
none.

### 0.5 Source references

Three reference shapes already exist:

- `CodeSymbolResponseDto` — `filePath`, `startLine`, `endLine`,
  `name`, `qualifiedName`, `type`, `language`.
- `RepositoryFileResponseDto` — `path`, `language`, `lineCount`,
  and the `generated`, `ignored`, `binary` flags.
- `RetrievedChunkReference`
  (`apps/api/src/modules/retrieval/types/retrieved-context.type.ts`)
  — `chunkId`, `repositoryId`, `filePath`, `symbolName`,
  `qualifiedName`, `startLine`, `endLine`, `score`.

`RetrievedChunkReference` is the shape the product already
surfaces as citations, both in chat and in generated guides.

### 0.6 Existing question, answer, and citation path

Questions are answered today by `ChatService.ask` and
`ChatService.stream` (`apps/api/src/chat/chat.service.ts`).
Verified properties:

- A question requires an existing `Conversation`.
  `prepareTurn` calls `conversationsService.requireConversation`
  before anything else. There is no stateless question endpoint.
- `Conversation.repositoryId` is nullable, so a conversation is
  either repository-scoped or workspace-scoped.
- Each turn persists a `USER` `Message` and an `ASSISTANT`
  `Message`; the assistant message stores sources, model,
  usage, provider and a `truncated` flag in `metadata`.
- Retrieval is a single call to `RetrievalService.retrieve` with
  `topK: 12`, scoped to the conversation's repository when set.
  There is no structured or lexical query path.
- The prompt is assembled by `PromptContextBuilder`
  (`apps/api/src/chat/prompt-context.builder.ts`): a fixed
  system prompt, a repository section, a retrieved-sources
  section bounded by `maxChunkChars` (default 12 000) that
  truncates with an explicit note, then up to 8 recent history
  messages, then the question.
- Generation uses `WorkspaceLlmResolver.resolve(workspaceId)` and
  the `LlmProvider` contract, so hosted and BYOK providers both
  work.
- Streaming emits `sources`, then `token` events, then
  `message`, then `done`, over SSE from `ChatController.stream`.
  A mid-stream provider failure after partial content is
  persisted as a truncated answer rather than discarded.
- Citations are persisted by
  `AnalyticsService.recordSourceCitations` into
  `MessageSourceCitation`, which requires a non-null `chunkId`
  UUID plus `score` and `rank`. It maps directly from
  `RetrievedChunkReference`. A citation that is not backed by a
  chunk cannot be stored in this model.
- Answer quality feedback exists as `AnswerFeedback`
  (`HELPFUL` / `NOT_HELPFUL`, unique per message and user).

### 0.7 Existing quota accounting

`ChatService.ask` and `stream` both call
`usageService.assertWithinLimit(workspaceId, UsageMetric.AI_QUESTIONS)`.

`UsageService.countUsed` (`apps/api/src/usage/usage.service.ts`)
counts `AI_QUESTIONS` as the number of `USER` `Message` rows in
non-deleted conversations of the workspace for the current UTC
month. Any question persisted as a `USER` message therefore
consumes the quota automatically; a question that is not
persisted as a message consumes nothing.

`AI_QUESTIONS` is in `BYOK_UNLIMITED_METRICS`, so a workspace
with an active BYOK provider has no cap on it.

Asking is restricted to `OWNER`, `ADMIN`, `MEMBER` on
`ChatController`, while reading conversations also admits
`VIEWER`. Both ask endpoints are rate limited to 20 requests per
60 seconds.

### 0.8 Existing retrieval characteristics

`RetrievalService.retrieve` embeds the query, searches Qdrant
with workspace, repository and indexing-run filters built by
`SearchFilterBuilder`, ranks with `SearchRankingService`, and
assembles a `RetrievedContext` of chunks, symbols, files and
references. Results are cached by a key derived from workspace,
query text, repositories, revisions and `topK`.

`docs/Architecture.md` §5.5 states that hybrid lexical search,
reranking, intent detection, and graph retrieval are not
implemented. Verification confirms this: there is no lexical
index, no reranker, no intent classifier, and Qdrant is the only
vector store adapter.

### 0.9 Existing technology detection

Technology evidence comes from `techMarkers` in the language
packs, merged by `LanguagePackRegistry.topologyHints` and
evaluated by `IndexedTopologyAnalyzer.technologyEvidence`.

Verified: every marker is a regular expression matched against a
**file path**, and all of them target manifest or configuration
filenames — for example `package.json`, `nest-cli.json`,
`next.config.*`, `composer.json`, `artisan`, `pyproject.toml`,
`go.mod`, `cargo.toml`. There is no content-based technology
detection, and there is no marker for any message broker,
queue, or streaming platform.

This directly constrains technology-oriented questions such as
the roadmap's "Show all Kafka consumers": no structured data
about brokers or consumers exists anywhere in the system.

## 1. Goal

Allow an authorized workspace member to ask architecture-oriented
questions about one indexed repository in natural language, and
receive an answer that is grounded in structured architecture
data where such data exists, supported by source evidence, and
explicit about what could not be established.

Architecture Search is the question-answering surface of
Phase 2. It consumes the module and dependency model defined by
Dependency Mapping and the existing retrieval and LLM
infrastructure. It produces no new structural data of its own.

## 2. User problem

The MVP already answers "how does this work" questions from
source chunks. It answers structural questions badly, because
the only evidence it can retrieve is semantically similar code,
and semantic similarity does not establish a dependency.

An engineer asking "what depends on Auth?" today receives an
answer assembled from code that merely resembles authentication.
The answer may be fluent, unsourced in the structural sense, and
wrong, with no signal that it was a guess.

Engineers need:

- structural questions answered from structural facts;
- a clear distinction between a proven relationship, an inferred
  suggestion, and a question that cannot be answered from the
  available data;
- evidence they can open and verify;
- an honest refusal instead of a confident fabrication.

## 3. Scope

In scope:

1. Asking architecture-oriented questions about a single
   repository that has a usable indexing revision.
2. Interpreting the question to determine whether structured
   architecture data is relevant, and which structural lookup it
   implies.
3. Querying the module and dependency model defined by
   Dependency Mapping for exact structural answers.
4. Retrieving supporting source context through existing
   retrieval where it adds value.
5. Generating an answer through the existing LLM abstraction,
   constrained to the supplied structured facts and source
   evidence.
6. Presenting structured results, source evidence, confidence,
   and stated limitations alongside the answer.
7. Declining or qualifying questions that available data cannot
   support.
8. Bounded structured and source context for large
   repositories.
9. Identifying the indexing revision the answer is based on.
10. Empty, processing, partial, and error states.

Out of scope for this feature:

- Rendering the dependency graph, which Dependency Mapping owns.
- Generated architecture prose documents, which System Overview
  owns.
- Deriving modules or dependencies. Architecture Search is a
  consumer of that model, never a second producer of it.

## 4. Non-goals

- Replacing or modifying existing repository or workspace chat.
- Workspace-wide or cross-repository architecture search.
- Building a lexical or hybrid search engine, a reranker, or a
  second vector store.
- Introducing a second retrieval pipeline, a second indexing
  pipeline, or a second LLM abstraction.
- Autonomous tool-calling or agentic multi-step planning.
- Model fine-tuning or embedding model changes.
- Answering questions about runtime behavior, traffic, latency,
  deployment topology, or message brokers as established fact.
- Change impact prediction or blast-radius estimation (Phase 4).
- Architecture decision records or decision reasoning (Phase 3).
- Design review, recommendations, or compliance judgements
  (Phase 5).
- Writing code, opening pull requests, or modifying the
  repository.
- Persisting a durable, queryable history of architecture
  answers beyond what existing conversation storage provides.

## 5. User stories

- **US-1.** As a workspace member, I ask which modules depend on
  a named module and receive the actual list, so that I learn
  the real dependents rather than similar-looking code.
- **US-2.** As a workspace member, I ask what a named module
  depends on and receive the actual list.
- **US-3.** As a workspace member, I ask which modules are
  connected to a named module in either direction and receive
  both directions distinguished.
- **US-4.** As a workspace member, I ask where a shared utility
  is used and learn which modules reference it, with the caveats
  that apply.
- **US-5.** As a workspace member, I ask a question whose answer
  needs source context rather than structure, and still receive
  a useful cited answer.
- **US-6.** As a workspace member, I ask about a technology or
  runtime concept the system cannot observe, and receive a clear
  statement that it cannot be established from indexed data,
  rather than an invented answer.
- **US-7.** As a workspace member, I name a module ambiguously
  and the system tells me which candidates it matched instead of
  silently picking one.
- **US-8.** As a workspace member, I can open the evidence
  behind every structural claim in the answer.
- **US-9.** As a workspace member, I can tell which parts of the
  answer are proven relationships and which are the model's
  interpretation.
- **US-10.** As a workspace member, I can see which indexing
  revision and commit the answer reflects.
- **US-11.** As a workspace member in a very large repository, I
  receive a bounded answer that says what it summarized rather
  than silently omitting data.
- **US-12.** As a workspace member, I can tell the team whether
  an architecture answer was helpful, using the same feedback
  affordance as existing answers.

## 6. Functional requirements

### FR-1: Access

An authorized member of the workspace owning the repository can
ask architecture questions about it.

Asking is a generation operation and follows the existing
generation role model rather than the read model: the roles that
may ask questions in chat today may ask architecture questions.
Whether the read-only role may ask is an open question (Q-12).

### FR-2: Question submission

A member submits a natural-language question scoped to one
repository that has a usable indexing revision.

The system must validate that the question is non-empty and
within a stated length bound, and must reject input that exceeds
it with a clear message.

### FR-3: Intent interpretation

The system must interpret the question to determine:

- whether structured architecture data is relevant;
- which structural lookup, if any, the question implies;
- which entities in the question refer to modules or symbols in
  the repository;
- whether the question is answerable from available data at all.

The set of supported intents must be explicitly defined and
documented. A question outside the supported set must be handled
by FR-8 rather than silently degraded into generic chat.

### FR-4: Structural resolution

When the question names a module, symbol, or path, the system
must resolve that name against the current revision's
architecture model and report the resolution outcome:

- resolved to exactly one module or symbol;
- resolved ambiguously to several candidates;
- not resolved.

The system must not proceed as though an unresolved or ambiguous
name were resolved.

### FR-5: Structured query

When structured architecture data is relevant, the system must
query the module and dependency model rather than inferring
structure from retrieved text.

Structural answers must be derived from the model defined by
Dependency Mapping, including its confidence classification,
supporting relationship counts, and contributing relationship
types.

### FR-6: Supporting retrieval

The system may retrieve supporting source context through
existing retrieval to explain, illustrate, or enrich an answer.

Retrieved context must never be used to assert, create, or
upgrade a structural relationship. Its role is explanatory only.

### FR-7: Answer generation

The system must generate the answer through the existing LLM
abstraction, using the resolved structured facts and retrieved
evidence as its constraining context.

The generated answer must:

- state the structural findings, when structural findings exist;
- distinguish structural facts from its own interpretation;
- reference source evidence for structural claims;
- state applicable limitations;
- avoid asserting anything the supplied context does not
  support.

### FR-8: Unanswerable and unsupported questions

When a question cannot be answered from available data, the
system must say so and explain why, in terms the member can act
on — for example that the language is unsupported, that the
named module was not found, that the relationship type is not
extracted, or that the question concerns runtime behavior the
system does not observe.

The system must not substitute a plausible answer for a missing
one.

### FR-9: Structured results are first-class

Structural findings must be available to the member as
structured data, not only as prose inside the generated answer.
A dependency list produced by a structural query must be
presentable as a list of modules with their counts and
confidence.

### FR-10: Evidence exposure

Every structural claim in an answer must be traceable to
evidence as defined in section 12, and that evidence must be
reachable from the answer.

### FR-11: Revision identification

Every answer must identify the indexing revision and, where
available, branch and commit it was based on.

### FR-12: Bounded work

Architecture Search must be bounded in the amount of structured
data and source context it assembles, and must not perform
unbounded structural traversal.

### FR-13: Quota and rate limiting

Architecture questions are AI questions. They must consume the
workspace's existing question allowance and be subject to
request rate limiting, consistent with existing question
endpoints.

Verification established that the existing allowance is counted
from persisted `USER` message rows, so the accounting outcome
depends on whether architecture questions are persisted as
conversation messages. That choice must not result in an
unmetered question path (Q-4).

### FR-14: Feedback

A member must be able to rate an architecture answer using the
existing answer feedback semantics.

### FR-15: Non-interference

Architecture Search must not change existing behavior of
repository ingestion, indexing, repository or workspace chat,
onboarding guide generation, authentication, authorization, or
usage accounting.

## 7. Architecture and data requirements

These constrain the data the feature needs, not how it is built.

### AD-1: Consumer of the architecture model

Architecture Search consumes the module and dependency model
specified in `../dependency-mapping/spec.md`. It must not define
its own grouping rules, its own dependency derivation, or its
own confidence classification.

If Dependency Mapping cannot supply a structural answer for a
supported intent, Architecture Search must report that, not
compute a replacement.

### AD-2: Reuse of existing infrastructure

The feature must reuse the existing retrieval boundary, the
existing LLM provider abstraction including workspace BYOK
resolution, the existing authorization guards, and the existing
usage accounting.

Per parent specification §5, introducing a parallel retrieval or
LLM infrastructure requires a recorded architectural decision.

### AD-3: Required conceptual entities

The following must be representable. Whether any of them is
persisted is an implementation decision (Q-3, Q-5).

- **Question**: repository, revision, workspace, author, text.
- **Interpreted intent**: the supported intent matched, the
  entities extracted, and the resolution outcome per entity.
- **Structural finding**: the structural query performed and its
  bounded result, carrying module identity, direction, counts,
  contributing relationship types, and confidence.
- **Evidence set**: structural evidence items and retrieved
  source references, distinguishable by origin.
- **Answer**: generated text, the revision it was based on,
  stated limitations, and the model and provider used.

### AD-4: Tenancy

Because `CodeSymbol` and `SymbolRelation` carry no
`workspaceId`, all structural data must be reached only through
a repository confirmed to belong to the requesting workspace.

### AD-5: Revision binding

A single answer must be based on exactly one indexing revision.
Structured findings, evidence, and retrieval results in one
answer must all come from that revision.

The revision must be selected explicitly and reported, rather
than each part of the pipeline independently resolving "the
latest successful revision".

### AD-6: Citation storage constraint

Verification established that the existing citation model
`MessageSourceCitation` requires a non-null `chunkId`, a
`score`, and a `rank`, and is populated only from
`RetrievedChunkReference`.

Structural evidence derived from symbols and relationships has
no chunk and no similarity score. The feature therefore requires
either a citation representation that can express non-chunk
evidence, or an explicit decision that structural evidence is
presented without being persisted as a citation. This must be
resolved rather than silently dropped (Q-5).

### AD-7: Context budget

The structured facts and source context supplied to the LLM must
fit a declared budget, and truncation must be explicit in the
supplied context as well as in the user-facing answer, consistent
with how the existing prompt builder marks truncation.

### AD-8: Language coverage

Structural coverage is limited to what the existing packs
extract for TypeScript, JavaScript, Python, and PHP. Questions
touching other languages, generated files, or unparsed manifests
must be answered with that limitation stated.

## 8. Relationship semantics

Binding on both data and wording.

### RS-1: Static and syntactic only

All structural facts derive from static, syntax-level
extraction over one revision. Answers must never describe them
as runtime behavior, call frequency, traffic, or data flow.

### RS-2: Relationship types

Only `IMPORTS`, `EXPORTS`, `EXTENDS`, `IMPLEMENTS`, `CALLS`,
`USES` exist. Answers must not invent relationship types, and
must be able to state which types supported a claim.

### RS-3: Confidence classification

Every structural claim must carry the classification defined by
Dependency Mapping — resolved, unresolved, or external — and
that classification must reach the member.

### RS-4: Three-way epistemic distinction

Answers must distinguish:

- **Observed** — supported by resolved structural data, with
  evidence.
- **Interpreted** — the model's reading of evidence, plausible
  but not structurally proven.
- **Not establishable** — outside what indexed data can support.

An answer must never present interpreted or not-establishable
content in the register of observed fact.

### RS-5: Similarity is never proof

Semantic similarity, retrieval rank, and retrieval score must
never be presented as evidence of a dependency, and must never
promote a relationship's confidence. This restates parent
specification §4.4 as a hard constraint on answer content.

### RS-6: Known imprecision must not be overstated

Answers must not overstate precision beyond what extraction
supports. Specifically: import relationships attach to a file's
module symbol rather than the using symbol; import target names
are identifier tokens taken from statement text and may include
names that are not imported symbols; `CALLS` and `USES` targets
are bare names attributed to the narrowest enclosing symbol by
line range; `EXTENDS` and `IMPLEMENTS` targets are bare type
names with no location.

### RS-7: Absence is not proof of absence

An empty structural result means no relationship was observed in
supported languages in this revision. Answers must not render
that as proof that no dependency exists.

### RS-8: Technology and runtime questions

No structured data exists about message brokers, queues,
streaming platforms, network calls, or deployment topology.
Technology detection is limited to manifest and configuration
file-path patterns.

Questions of this kind must be answered either from retrieved
source evidence, clearly marked as interpreted, or as not
establishable. They must never be answered as though a
structural inventory of such components existed.

## 9. UI behavior

### UI-1: Entry point

Architecture Search is reachable from the repository's
Architecture Explorer context, for a repository with a usable
indexing revision.

### UI-2: Question input

The member enters a natural-language question with the
repository scope visible, so it is unambiguous what is being
asked about.

### UI-3: Answer presentation

An answer presents the generated text, the structural findings
as structured content per FR-9, the evidence, the confidence and
epistemic markers per RS-3 and RS-4, the revision per FR-11, and
the applicable limitations.

### UI-4: Epistemic markers are always visible

Observed, interpreted, and not-establishable content must be
distinguishable without opening a detail view.

### UI-5: Ambiguity surfacing

When a named entity resolved ambiguously, the surface must show
the candidates and let the member choose or refine, rather than
presenting an answer about an arbitrary candidate.

### UI-6: Evidence navigation

Evidence must be openable, and must lead into existing file and
symbol browsing or into the Dependency Mapping view, preserving
repository and revision context and allowing return.

### UI-7: Progressive output

Progressive delivery of the answer is permitted and should
follow the existing streaming event conventions where used.
Structural findings and evidence must be available to the member
no later than the completed answer, and partial output must be
visually distinct from a completed answer.

### UI-8: Bound disclosure

When structured results, evidence, or context were bounded, the
surface must say so and describe what was omitted in aggregate
terms.

### UI-9: Feedback affordance

The existing helpful / not-helpful affordance applies to
architecture answers.

### UI-10: Consistency with existing patterns

The surface follows existing web conventions: feature-scoped
modules with colocated components, hooks and services,
centralized API access, typed entity contracts, and existing
shared page, header, and empty-state primitives, per
`apps/web/src/ARCHITECTURE.md`.

### UI-11: Read-only

Architecture Search must offer no mutation of repositories,
modules, dependencies, or indexed data.

## 10. Empty, loading, and error states

### ST-1: No successful index

If the repository has no successful indexing revision, the
surface must state that architecture search is unavailable and
point to the repository's indexing state. Questions must not be
accepted into a pipeline that cannot answer them.

### ST-2: Indexing in progress

If a rebuild is running and a previous successful revision
exists, search remains available against that revision, labeled
as such. If no previous revision exists, ST-1 applies.

### ST-3: No architecture model

If the revision produced no modules or no resolvable
dependencies, structural questions must be answered with that
stated limitation, and the member must be told which questions
remain answerable from source evidence alone.

### ST-4: Entity not found

If a named module or symbol does not resolve, the surface must
say so and may offer near candidates, without answering about a
different entity.

### ST-5: Ambiguous entity

Handled by UI-5 rather than by choosing silently.

### ST-6: Unsupported intent

If the question falls outside supported intents, the surface
must say what kinds of architecture questions are supported.

### ST-7: Empty structural result

A genuinely empty result must be reported as "no relationship
observed", with RS-7 wording, never as "no dependency exists".

### ST-8: Loading

Loading must be distinguishable from empty, and partial output
must not be presented as complete.

### ST-9: Generation failure

If generation fails before any content, the surface must present
an understandable failure with a retry affordance. If it fails
after partial content, the partial answer must be marked
incomplete, consistent with the existing truncated-answer
behavior.

### ST-10: Retrieval or structural failure

If one evidence source fails and the other succeeds, the answer
must be produced from what is available and state what was
missing. If neither is available, no answer may be generated.

### ST-11: Quota exhausted

If the workspace question allowance is exhausted, the surface
must state the limit clearly and must not generate an answer.

### ST-12: Provider unavailable or misconfigured

If the resolved provider is unavailable or a workspace-owned key
is invalid, the surface must state that AI generation is
unavailable without exposing key material or provider
internals.

### ST-13: Errors are sanitized

No message may expose secrets, tokens, credentials, absolute
host paths, stack traces, prompts, or provider internals.

## 11. Large graph and large context behavior

### LG-1: Bounded structural results

Every structural result must be bounded, ordered
deterministically, and disclosed as bounded when truncated.

### LG-2: No unbounded traversal

Only the structural neighborhoods that supported intents require
may be queried. Whole-graph traversal and unbounded transitive
expansion are not permitted.

### LG-3: Bounded evidence

Evidence per structural finding must be bounded, consistent with
Dependency Mapping's evidence bounds.

### LG-4: Bounded retrieval

Supporting retrieval must use a bounded result count consistent
with existing retrieval usage.

### LG-5: Declared context budget

The MVP must declare a context budget covering the maximum
structured facts, retrieved chunks, and total context size
supplied to the provider. Exact values are an open question
(Q-8), but they must be fixed and documented.

### LG-6: Summarize rather than omit

When structured results exceed their bound, the answer must
state aggregate counts for the omitted remainder rather than
implying the shown subset is complete.

### LG-7: Non-blocking

Answering must not block unrelated API requests. Expensive work
must respect the existing separation between request handling
and background processing.

## 12. Source and evidence requirements

### EV-1: Two evidence kinds, always distinguishable

An answer may carry:

- **structural evidence** — derived from symbols and
  relationships, identifying the modules and the underlying
  source locations that produced a structural claim;
- **retrieved source evidence** — existing chunk-backed
  references.

Their origin must be distinguishable to the member. Retrieved
evidence must never be presented as structural proof.

### EV-2: Evidence content

An evidence item must identify the repository, the file path,
the line range where available, the symbol name and qualified
name where available, and for structural evidence the
relationship type it came from.

The MVP must adopt one consistent reference shape across Phase 2
rather than introducing a fourth (Q-6).

### EV-3: Structural claims require evidence

Every claim classified as observed must carry at least one
concrete source location.

### EV-4: Provenance

All evidence must come from the same revision as the answer.

### EV-5: Evidence is not generated

Evidence items must be derived from indexed data. The LLM must
not invent, reword, or infer evidence items, and evidence must
not be accepted from model output.

### EV-6: No secret exposure

Files excluded from indexing remain excluded from evidence and
from the generated context. Repository secrets must not enter
the provider context or the answer.

### EV-7: Evidence is verifiable

Every evidence item must be openable in the existing browsing
surfaces so the member can check it.

## 13. Index revision behavior

### IR-1: Explicit selection and reporting

An answer is based on one explicitly selected successful
revision, reported with the answer.

### IR-2: Default revision

By default the most recent successful revision is used.

### IR-3: No mixing

Structured findings, evidence, and retrieval results in one
answer must belong to one revision. The existing pattern of each
read path independently resolving "latest successful run" must
not be inherited.

### IR-4: During rebuild

The previous successful revision remains the basis for answers
while a rebuild runs, labeled as such.

### IR-5: Revision change during a question

If a newer revision becomes current while a question is being
answered, the answer must remain consistent with the revision it
started from and must report that revision.

### IR-6: Historical answers

An answer retained after its revision is superseded must remain
attributable to the revision it was based on, and must not be
presented as reflecting current code.

### IR-7: Revision no longer available

If the revision an answer depended on is gone, the answer must
remain marked as historical, and new questions must use an
available revision or the appropriate empty state.

## 14. Security and isolation requirements

### SEC-1: Workspace boundary

All structural data, evidence, retrieval context, and generated
answers must be scoped to the requesting workspace. No data from
another workspace may be exposed, including through module
names, counts, file paths, evidence, or error messages.

### SEC-2: Repository boundary

Repository membership in the requesting workspace must be
confirmed before any architecture data or retrieval occurs,
consistent with the existing distinction between validating
repository membership and performing a live provider access
check for mutating operations.

### SEC-3: Role model

Asking follows the existing generation role model rather than
the read model. The feature introduces no new privileged
operation.

### SEC-4: Retrieval isolation

Supporting retrieval must apply the existing workspace,
repository, and revision filters. A question scoped to one
repository must not retrieve from another.

### SEC-5: No secrets in provider context

Repository secrets, credentials, tokens, and provider keys must
never be placed in the generated context or the answer.

### SEC-6: Untrusted repository content

Repository content supplied as context is untrusted input.
Instructions embedded in source code or comments must not be
allowed to change the system's behavior, expand its scope beyond
the authorized repository, or cause it to present unsupported
claims as fact.

### SEC-7: Enumeration resistance

Identifiers that do not resolve within the requesting workspace
must not be distinguishable from identifiers that do not exist.

### SEC-8: Error hygiene

Errors must not expose secrets, tokens, absolute host paths,
prompts, stack traces, or provider internals.

### SEC-9: Accounting integrity

Architecture questions must be metered. No code path may provide
unmetered AI generation.

## 15. Acceptance criteria

- **AC-1.** Given an authorized member and a repository with a
  successful indexing revision, when the member asks a supported
  architecture question, then the system returns an answer that
  identifies the repository and the revision used.
- **AC-2.** Given a repository with resolvable dependencies,
  when the member asks what depends on a named module, then the
  answer's structural findings are derived from the architecture
  model and match what Dependency Mapping reports for that
  module's dependents.
- **AC-3.** Given a supported structural question, when the
  answer makes a structural claim, then that claim carries at
  least one concrete source location from the same revision, and
  the evidence is reachable from the answer.
- **AC-4.** Given a question the available data cannot support,
  when the system answers, then it states the limitation or
  uncertainty and does not present an unsupported conclusion as
  fact.
- **AC-5.** Given a question about a technology or runtime
  concept for which no structured data exists, such as message
  brokers or consumers, when the system answers, then it does
  not claim a structural inventory of such components and marks
  any source-derived content as interpreted.
- **AC-6.** Given a question naming an entity that matches
  several modules, when the system answers, then it reports the
  candidates rather than silently answering about one.
- **AC-7.** Given a question naming an entity that does not
  exist in the revision, when the system answers, then it states
  that the entity was not found and does not answer about a
  different entity.
- **AC-8.** Given a structural result larger than the declared
  bound, when the answer is returned, then it is bounded, states
  that it is bounded, and reports aggregate counts for the
  remainder.
- **AC-9.** Given any answer, when its content is examined, then
  observed, interpreted, and not-establishable content are
  distinguishable, and no retrieval score or similarity is
  presented as evidence of a dependency.
- **AC-10.** Given a repository with no successful indexing
  revision, when the member opens Architecture Search, then the
  system presents an unavailable state and does not generate an
  answer.
- **AC-11.** Given a repository in workspace A, when a member of
  workspace B asks a question about it, then the request is
  rejected and no module names, structural data, file paths, or
  evidence are exposed.
- **AC-12.** Given a workspace whose question allowance is
  exhausted, when a member asks an architecture question, then
  the system refuses with a clear limit message and generates no
  answer.
- **AC-13.** Given a provider failure during generation, when
  the member sees the result, then the surface presents an
  understandable state, marks any partial answer incomplete, and
  exposes no secrets or provider internals.
- **AC-14.** Given a single answer, when its contents are
  examined, then every structural finding and evidence item in
  it belongs to the same indexing revision.
- **AC-15.** Given repository content containing instructions
  aimed at the model, when a question is answered, then the
  system's scope, authorization, and evidence requirements are
  unchanged.
- **AC-16.** After implementation, existing repository
  ingestion, chat, onboarding guide, usage limit,
  authentication, and workspace isolation tests continue to
  pass.

## 16. Edge cases

- Question naming a module that matches many modules, for
  example a repeated folder name in a monorepo.
- Question naming a symbol rather than a module.
- Question naming a file path directly.
- Question naming an external package.
- Question naming a technology with no marker, such as a
  message broker.
- Question about runtime concerns: latency, scaling, deployment,
  traffic.
- Question in a language other than English.
- Question containing no architectural entity at all.
- Question that is a statement, a greeting, or an instruction.
- Extremely long question, or one padded to consume the context
  budget.
- Question that asks for the whole graph.
- Question implying transitive reach, such as "everything
  ultimately depending on X".
- Question about a cycle between modules.
- Repository whose relationships are all unresolved, for example
  a PHP-only repository where import targets carry no path.
- Python repository using only plain `import` statements.
- Repository with modules but zero dependencies.
- Repository with exactly one module.
- Repository containing only unsupported languages.
- Repository containing only manifests.
- Reindex completing between the structural query and
  generation.
- Two rebuilds completing during one question.
- Repository disconnected or soft-deleted mid-question.
- Member's role changing mid-question.
- Concurrent questions about the same repository from several
  members.
- Repeated identical question, where a cached retrieval result
  may be reused.
- Workspace switching from hosted AI to a workspace-owned key
  between questions.
- Provider returning empty content, or content that ignores the
  requested structure.
- Provider returning fabricated file paths not present in the
  evidence set.
- Source content containing text that imitates evidence
  formatting.
- Answer retained after its revision is deleted.

## 17. Definition of done

- Supported intents are implemented and documented, including
  what is not supported.
- Structural answers are derived from the Dependency Mapping
  model, with confidence and evidence.
- Observed, interpreted, and not-establishable content are
  distinguishable in every answer.
- Unanswerable questions produce explicit limitations rather
  than fabricated answers.
- Context and result bounds are implemented and documented.
- Revision identification and non-mixing are verified.
- Workspace isolation and question metering are verified.
- All acceptance criteria in section 15 are verified by
  automated tests.
- Existing MVP functionality remains functional.
- Deviations from this specification are recorded in
  `../decisions.md`.
