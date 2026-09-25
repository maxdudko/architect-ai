# Dependency Mapping

First feature of Phase 2 — Architecture Explorer. It shows which
folder-level modules a repository contains and which modules depend on
which, derived entirely from data already produced by indexing.

Spec: [docs/specs/phase-2-architecture-explorer/dependency-mapping/spec.md](../specs/phase-2-architecture-explorer/dependency-mapping/spec.md).
Resolved questions and deviations: [decisions.md](../specs/phase-2-architecture-explorer/decisions.md).

## Module Layout

`apps/api/src/modules/architecture/dependency-mapping/`

- `data/` — bounded Prisma loader for one indexing revision
- `derivation/` — file index, target resolution, grouping, graph building
- `cache/` — Redis cache with in-memory fallback
- `dto/` — request and response contracts
- `types/` — derived graph shapes

`apps/web/src/features/architecture/` holds the read surface, reachable
from the dashboard widget and the Architecture button on a repository.

## Pipeline

Nothing is written at index time and no schema changed. A request
derives the graph, or reads it from cache:

1. `DependencyMapService` resolves the repository within the workspace
   and picks the latest **succeeded** `IndexingRun`. That one
   `indexingRunId` is passed to everything downstream.
2. `DependencyGraphProvider` checks Redis
   (`depmap:v1:{repositoryId}:{indexingRunId}`, 600s), then an
   in-process single-flight map, then derives.
3. `PrismaArchitectureDataSource` loads the revision's files, module
   symbol counts, distinct `IMPORTS` rows, and counts of the other
   relationship types.
4. `ModuleGrouperService` groups files into modules.
5. `TargetResolverService` attributes each import to an indexed file,
   or states why it could not.
6. `DependencyGraphBuilder` produces directed, deduplicated,
   classified edges with bounded evidence.

## Model

A module is a folder grouping, not a package or a service:

- leading folder path of at most **2 segments**
- at least **2 indexed files**
- excluding `test|spec|fixture|vendor|generated|dist|build|node_modules`
- excluding files indexing marked ignored, binary or generated

Same rules as the onboarding topology analyzer, so both surfaces
describe the same repository the same way.

Every relationship lands in exactly one bucket — a module dependency,
an internal (same-module) relationship, an external package, or
unresolved. Nothing is dropped silently.

Each displayed item carries a confidence classification, never upgraded
by name similarity:

| Classification | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| `RESOLVED`     | Target attributed to an indexed file in this revision  |
| `EXTERNAL`     | Target is a package or builtin outside this repository |
| `UNRESOLVED`   | Target could not be attributed; no dependency is drawn |

An unresolved relationship reports a stated reason rather than
vanishing: `NO_TARGET_PATH_RECORDED`, `RELATIVE_PATH_NOT_FOUND`,
`ALIAS_UNRESOLVED`, `AMBIGUOUS_MATCH`, or `TARGET_MODULE_EXCLUDED`.

## REST

All three reads sit under
`/workspaces/:id/repositories/:repositoryId/architecture`, behind
`JwtAuthGuard` → `WorkspaceParamGuard` → `RolesGuard`. Every role that
can already read indexed content, including `VIEWER`, can read here. A
repository in another workspace returns **404, not 403**, matching the
existing repositories convention.

| Endpoint                                | Returns                                            |
| --------------------------------------- | -------------------------------------------------- |
| `GET dependency-map`                    | Modules, totals, exclusions, grouping rules, state |
| `GET dependency-map/module?key=`        | One module with dependencies and dependents        |
| `GET dependency-map/evidence?from=&to=` | Source evidence behind one directed dependency     |

Module keys are query parameters because they are folder paths
containing slashes.

The response `state` is one of `READY`, `NO_INDEX`, `REBUILDING`,
`NO_MODULES`, `NO_DEPENDENCIES` or `PARTIAL`. Each bounded set reports
`{ limit, returned, total, truncated }` so truncation is visible rather
than implied.

## Known limitations

These are properties of the available data, not defects. They are
returned with every response (`limitations`) and shown in the UI.

### The view under-reports by design

Only `IMPORTS` can produce a module dependency, because it is the only
relationship type written with a target path. A real inheritance, call
or usage crossing a module boundary produces **no edge**. Counts for
`EXPORTS`, `EXTENDS`, `IMPLEMENTS`, `CALLS` and `USES` are reported at
the repository level instead.

Consequently, absence of a dependency is never proof that no runtime
dependency exists. The `NO_DEPENDENCIES` state says so explicitly
rather than presenting an empty result as independence.

### Resolution coverage differs per language

Only TypeScript, JavaScript, Python and PHP are indexed at all; any
other language contributes no relationships.

| Language              | Recorded target    | Resolution                                                       |
| --------------------- | ------------------ | ---------------------------------------------------------------- |
| TypeScript/JavaScript | Import specifier   | Relative paths resolve directly; bare specifiers by suffix match |
| Python                | Dotted module name | Relative (`.models`) and absolute, tried from each ancestor dir  |
| PHP                   | _(none)_           | Always `NO_TARGET_PATH_RECORDED`                                 |

PHP is the significant gap: the language pack records `use` statements
as a qualified name with no path, so **no PHP repository produces
module dependencies today**. Closing it means emitting a target path
during PHP indexing, which is a change to the language pack and a
re-index, not to this feature.

### Path aliases are matched heuristically

The repository checkout is deleted after indexing, so `tsconfig.json`
`paths` and similar alias configuration cannot be read. A bare
specifier is matched against indexed path suffixes instead: exactly one
match resolves, several report `AMBIGUOUS_MATCH`, none reports
`ALIAS_UNRESOLVED` or is classified as an external package.

A single-segment specifier with no alias prefix is never suffix
matched, so `import 'uuid'` stays `EXTERNAL` and does not invent a
dependency on a local `src/uuid.ts`.

### Evidence is file-level, not line-level

`SymbolRelation` carries no line number, and `IMPORTS` attaches to the
whole-file module symbol. Evidence therefore identifies the source and
target **files**, and `startLine`/`endLine` on a reference are null for
imports. Line-level evidence would require recording import positions
during indexing.

### Modules are folders

A 2-segment folder prefix is a good approximation of structure and a
poor model of deployment. Derived modules do not necessarily correspond
to packages, services or deployment units, and a repository whose
layout does not follow folder boundaries will group poorly. The
grouping rules and the excluded-file count are returned with every view
so the result can be read critically.

### One revision, possibly truncated

A view never mixes revisions: the revision is resolved once per request
and forms part of the cache key. It reflects the latest **succeeded**
index, so it lags an in-flight re-index; `rebuildInProgress` signals
this.

Above 20,000 files or 50,000 distinct import rows the graph is derived
from truncated input and the whole view reports `PARTIAL` with stated
reasons.

## Extension Points

- `ArchitectureModule` exports `DependencyGraphProvider` and
  `DependencyMapService` for Architecture Search and System Overview.
- `ArchitectureSourceReferenceDto` is the single Phase 2 reference
  shape; reuse it rather than adding another.
- A new resolution strategy is a branch in `TargetResolverService` plus
  a `ResolutionStrategy` member — no schema or pipeline change.
- Persisting the graph, if cold-start derivation ever becomes too
  expensive, means adding a writer behind `DependencyGraphProvider`;
  nothing above it assumes derivation.
- `ARCHITECTURE_CACHE_DRIVER=memory` selects the in-memory cache, as
  used by the e2e suite.
