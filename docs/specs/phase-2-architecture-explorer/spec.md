# Phase 2 — Architecture Explorer

- Status: Draft
- Version: 1.0
- Product: Architect AI

## 1. Goal

Help engineering teams understand the structure of their
software systems through architecture visualization,
dependency exploration, architecture-oriented search,
and generated system overviews.

Architecture Explorer extends the existing repository
code intelligence capabilities without replacing the
MVP ingestion, indexing, or RAG infrastructure.

## 2. Problem Statement

The MVP enables engineers to explore source code, symbols,
and repository-scoped questions.

However, understanding a large codebase requires a higher-level
view of its architecture:

- Which modules exist?
- How are modules connected?
- Which components depend on a selected module?
- Where are the main architectural boundaries?
- What technologies and integration patterns are used?

Architecture Explorer provides these capabilities through
a shared architecture data model and three user-facing features.

## 3. Product Scope

### In scope

1. Dependency Mapping
2. Architecture Search
3. System Overview

### Out of scope

- Automatic code modifications.
- Pull request generation.
- Architecture decision records.
- Decision Memory.
- Change impact analysis.
- Runtime distributed tracing.
- Full runtime call graph reconstruction.
- Automatic refactoring recommendations.
- GitLab and Bitbucket ingestion.
- Enterprise architecture governance.
- Automatic microservice discovery with guaranteed accuracy.

## 4. Product Decisions

### 4.1 Primary architecture level

The primary visualization level is modules.

A module is a logical architectural grouping of source files,
defined using existing repository structure and supported
language/framework conventions.

The implementation must document the supported module detection
rules and their limitations.

### 4.2 Visualization model

The primary user experience is hierarchical exploration:

1. Repository-level architecture overview.
2. Module-level dependency graph.
3. Module details and related source files.
4. Drill-down to relevant symbols and source evidence.

A flat graph containing every symbol in the repository is not
the primary MVP experience.

### 4.3 Relationship model

The MVP represents statically observed relationships that
can be extracted from the existing code intelligence pipeline.

The system must distinguish observed static relationships
from inferred or unavailable runtime behavior.

### 4.4 Search strategy

Architecture Search uses a hybrid approach:

- Structured architecture data for exact dependency and
  relationship queries.
- Existing retrieval for relevant source context.
- LLM for intent interpretation, synthesis, and answer generation.

The system must not treat semantic similarity alone as proof
of a dependency relationship.

### 4.5 System Overview strategy

System Overview reuses the existing guide generation
and LLM infrastructure where practical.

The generated overview receives architecture-aware context
and must preserve existing workspace isolation and source
traceability requirements.

## 5. Existing Capabilities to Reuse

The implementation must investigate and reuse:

- Repository ingestion and indexing.
- Tree-sitter parsing and supported language packs.
- CodeSymbol persistence.
- SymbolRelation persistence.
- Repository and workspace authorization.
- Existing LLM provider abstraction.
- Existing retrieval and source citation mechanisms.
- Existing guide generation pipeline.
- Existing worker and queue infrastructure.
- Existing frontend navigation and data-fetching patterns.

The implementation must not introduce a parallel code
indexing or LLM infrastructure without an approved
architectural decision.

## 6. Functional Requirements

### FR-1: Architecture Explorer access

An authorized workspace member can open Architecture Explorer
for a repository that has a usable indexing result.

The interface must identify the selected repository and
the indexing revision associated with the displayed data.

If the repository is not ready, the interface must show
an appropriate unavailable or processing state.

### FR-2: Architecture data model

The system provides a normalized architecture representation
derived from existing code intelligence.

The model must support, at minimum:

- Architecture nodes representing modules.
- Relationships between nodes.
- References to underlying source files or symbols.
- Repository association.
- Index revision association.
- Relationship type where supported.
- Sufficient metadata for source evidence.

The exact persistence strategy must be determined during
implementation planning.

### FR-3: Dependency Mapping

An authorized workspace member can explore dependencies
between architectural modules.

The feature must support:

- Rendering a repository architecture view.
- Selecting a module.
- Viewing direct dependencies.
- Viewing direct dependents.
- Inspecting module metadata.
- Navigating to relevant source evidence.
- Handling repositories with no available relationships.
- Handling repositories whose graph is too large for a useful
  single visualization.

The MVP must define bounded behavior for large graphs,
such as limiting the initial view or requiring focused exploration.

### FR-4: Hierarchical exploration

The user can navigate from a high-level architecture view
to more detailed information.

The MVP should support:

- Repository overview.
- Module selection.
- Module dependency details.
- Related files and symbols.
- Source evidence for selected relationships.

The exact interaction design and graph rendering library
must be selected during implementation planning.

### FR-5: Architecture Search

An authorized workspace member can ask architecture-oriented
questions about a repository.

Example questions:

- What depends on Auth?
- Which components are connected to Billing?
- Where are Kafka consumers defined?
- Which modules import a specific shared utility?

The system must:

1. Interpret the user's question.
2. Identify whether structured architecture data is relevant.
3. Query the architecture model where appropriate.
4. Retrieve supporting source context where useful.
5. Generate an answer using the existing LLM infrastructure.
6. Present source evidence and relevant limitations.

### FR-6: Search correctness and uncertainty

The system must distinguish between:

- Directly observed static relationships.
- LLM-inferred relationships.
- Relationships that cannot be established from available data.

The system must not present unsupported runtime behavior
as a confirmed fact.

### FR-7: System Overview

An authorized workspace member can generate a high-level
architecture overview for a ready repository.

The overview should describe, where supported by available data:

- Main architectural modules.
- Important module dependencies.
- Technologies and infrastructure.
- Major integration patterns.
- Relevant architectural boundaries.
- Limitations and uncertain conclusions.

The overview must use the existing asynchronous generation
infrastructure where practical.

### FR-8: Overview persistence and regeneration

The system must follow an explicitly defined policy
for storing and regenerating the overview.

The MVP should prefer a simple current-overview model
unless existing persistence patterns make another approach
more appropriate.

The previous valid overview must not be lost before a
replacement has been successfully generated.

### FR-9: Workspace and repository isolation

Architecture data, dependency results, search context,
and generated overviews must respect existing authorization.

No information from an unauthorized workspace or repository
may be exposed.

### FR-10: Index revision consistency

Architecture views and generated overviews must identify
the successful indexing revision on which they are based.

The system must not silently combine incompatible
architecture data from different indexing revisions.

### FR-11: Failure and incomplete-data handling

The system must handle:

- Missing or incomplete indexing results.
- Unsupported language constructs.
- Repositories with insufficient architecture data.
- LLM failures.
- Invalid generated overview output.
- Large or overly complex dependency graphs.

Failures must produce understandable user-facing states
without exposing secrets or internal sensitive details.

## 7. Non-Functional Requirements

### NFR-1: Reuse existing architecture

The implementation must reuse the existing modular
monolith, worker, queue, authorization, and AI infrastructure
where appropriate.

### NFR-2: Security

All repository and architecture operations must enforce
existing workspace authorization boundaries.

Repository secrets must not be exposed to the LLM context
or generated architecture output.

### NFR-3: Explainability

Architecture relationships should be traceable to
underlying indexed source evidence where available.

The UI and AI responses must communicate limitations
of static analysis.

### NFR-4: Performance

The implementation must define bounded behavior for
large repositories and graphs.

Expensive LLM operations must not block API requests.

### NFR-5: Compatibility

Existing MVP features must remain functional, including:

- Repository ingestion.
- Repository chat.
- Existing onboarding guide generation.
- Authentication and workspace isolation.
- Existing AI provider integrations.

## 8. Acceptance Criteria

### AC-1: Architecture access

Given an authorized workspace member and a ready repository,
when the member opens Architecture Explorer,
then the system displays the architecture view for the
correct repository and indexing revision.

### AC-2: Module dependency exploration

Given a repository with supported architecture relationships,
when the member selects a module,
then the system displays its relevant direct dependencies
and direct dependents.

### AC-3: Source evidence

Given a displayed architecture relationship,
when the member requests details,
then the system provides relevant underlying source evidence
where available.

### AC-4: Empty and incomplete data

Given a repository with no usable architecture relationships
or incomplete analysis,
when the member opens Architecture Explorer,
then the system displays a clear state explaining the limitation
instead of showing misleading conclusions.

### AC-5: Architecture search

Given a repository with indexed architecture data,
when the member asks a supported architecture-oriented question,
then the system uses structured architecture data where relevant,
combines it with source retrieval when useful,
and returns an understandable answer with evidence.

### AC-6: Search uncertainty

Given a question that cannot be reliably answered from
static architecture data,
when the system generates a response,
then it must communicate the limitation or uncertainty
rather than presenting an unsupported conclusion as fact.

### AC-7: System overview generation

Given a ready repository,
when an authorized member requests an overview,
then the system creates an asynchronous generation job,
processes it through the existing infrastructure,
and produces an overview containing the supported
architecture information.

### AC-8: Overview regeneration

Given an existing valid overview,
when regeneration is requested,
then the system follows the defined replacement policy
and preserves the previous valid result until the new
result is successfully generated.

### AC-9: Workspace isolation

Given a repository or architecture result belonging
to workspace A,
when a user from workspace B attempts to access it,
then the system rejects the request and does not expose
the architecture data.

### AC-10: Existing functionality

After implementation, existing MVP functionality continues
to pass its relevant automated tests.

## 9. Success Metrics

The MVP should be evaluated using:

- Successful architecture exploration for supported repositories.
- Successful dependency navigation.
- Successful architecture-oriented search.
- Successful system overview generation.
- Source evidence availability for supported relationships.
- No confirmed workspace isolation regressions.
- No regressions in existing MVP functionality.

Quantitative product targets should be defined after
the initial implementation and user feedback.

## 10. Technical Risks

### R-1: Module detection

Different languages and frameworks expose different
architectural boundaries.

The implementation must define supported conventions
rather than promising universal module detection.

### R-2: Static analysis limitations

Static imports and symbol relationships do not represent
all runtime behavior.

The UI and AI responses must preserve this distinction.

### R-3: Graph complexity

Large repositories may produce dense or unreadable graphs.

The MVP must use bounded visualization and focused exploration.

### R-4: Context size

Architecture summaries and search answers may require
combining graph data with source context.

The implementation must define context selection and
size limits.

### R-5: LLM hallucination

Generated overviews and search answers may contain
unsupported claims.

Source evidence, structured context, output validation,
and explicit uncertainty handling are required.

### R-6: Index revision changes

Architecture data can become stale after repository updates.

The implementation must define how revisions are identified
and how stale results are handled.

## 11. Open Questions for Implementation Planning

The following questions must be resolved during
implementation planning or explicitly deferred:

1. Which module detection rules are supported in the MVP?
2. Which exact relationship types already exist in SymbolRelation?
3. Can the architecture model be derived on demand,
   or does it require persisted/cached data?
4. What graph visualization library best fits the existing frontend?
5. What graph size limits are appropriate?
6. Which architecture search intents are supported initially?
7. What exact output schema should System Overview use?
8. How should overview generation handle concurrent requests?
9. What is the exact source reference format?
10. Which automated tests are required for each acceptance criterion?

## 12. Definition of Done

Phase 2 MVP is complete when:

- The three scoped features are implemented.
- The architecture model and supported relationship types
  are documented.
- All mandatory acceptance criteria are verified.
- Relevant unit, integration, and end-to-end tests pass.
- Workspace isolation is verified.
- Existing MVP functionality remains functional.
- Known limitations are documented.
- Implementation deviations are recorded in decisions.md.
