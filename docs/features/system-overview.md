# System Overview

Third feature of Phase 2 — Architecture Explorer. It writes one current
architecture overview per repository from the dependency graph already
produced by Dependency Mapping. It does not derive modules, draw the map,
or answer ad-hoc questions.

Spec: [docs/specs/phase-2-architecture-explorer/system-overview/spec.md](../specs/phase-2-architecture-explorer/system-overview/spec.md).
Resolved questions: [decisions.md](../specs/phase-2-architecture-explorer/decisions.md).

## Module layout

`apps/api/src/modules/architecture/system-overview/`

- `system-overview.service.ts` — read the current overview and enqueue a run
- `system-overview.orchestrator.ts` — revision selection, context, generation, validation, replacement
- `overview-facts.ts` — bounded facts from the dependency graph
- `system-overview-prompt.builder.ts` — answer prompt
- `overview-markdown.ts` — required sections and length cap
- `cited-paths.ts` — paths the model cited, checked before replacement
- `queue/` — BullMQ job, or an in-memory queue when `ARCHITECTURE_OVERVIEW_QUEUE_DRIVER=memory`

`apps/web/src/features/architecture/` holds the Overview page next to the
dependency map and search. The page is
`/repositories/[repositoryId]/architecture/overview`.

## Why it is not a guide

Onboarding guide generation defaults a missing type list to every
`GuideType`, and any active guide run for the repository is returned
instead of starting another. The overview therefore has its own document
and its own generation run. It still uses the same worker enable flag
(`ONBOARDING_WORKER_ENABLED` or `INDEXING_WORKER_ENABLED`), the same Redis
connection, `WorkspaceLlmResolver`, `RetrievalService`, and the
`GUIDE_GENERATIONS` allowance.

## Document

Required H2 headings, in order:

1. Main Modules
2. Module Dependencies
3. Technologies and Infrastructure
4. Integration Patterns
5. Architectural Boundaries
6. Limitations

A missing section is filled with `Unclear from indexed evidence.` The
stored document is capped at 16,000 characters by shortening section
bodies. Every cited repository path must exist on the selected indexing
revision. A fabricated path fails the run and leaves the previous overview
in place.

If the revision has no modules, generation still runs and the limitations
section states that the overview is not dependency-grounded. Folder
statistics are not supplied as a substitute.

## Who can generate

`OWNER`, `ADMIN`, and `MEMBER` can request generation. `VIEWER` can read
the current overview and cannot generate. A repository in another
workspace returns **404** before any graph or retrieval read.

Generation requires `status === READY` and a successful indexing revision.
The request returns **202** with the run and does not call the model.
A second request while a run is `QUEUED` or `RUNNING` returns that run.
A guide generation run does not block an overview, and an overview run
does not block guides.

Each created run counts toward `GUIDE_GENERATIONS`. Quota is checked
before the run row is written.

## Budgets

These limits are fixed. Requests cannot raise them.

| Budget                            |             Limit |
| --------------------------------- | ----------------: |
| Modules                           |                20 |
| Dependencies among those modules  |                40 |
| Unresolved and external summaries |                20 |
| Technology hints and entry points |                20 |
| Retrieval `topK`                  |                 8 |
| Retrieved source text             |  8,000 characters |
| Structured facts                  | 12,000 characters |
| Stored markdown                   | 16,000 characters |

Modules follow the dependency map's significance order. Retrieval is
pinned to the indexing revision selected when the job starts. A newer run
completing mid-job does not change the recorded revision. Truncation is
stated in the prompt and in the limitations section.

## Revision

The revision is chosen once, at the start of the job, from the latest
succeeded indexing run. The overview records that run, branch, and commit.
When a newer succeeded run exists, the page marks the overview stale and
offers regeneration to members who can generate. The previous document
stays readable throughout regeneration.

## Limitations

- The overview reflects statically observed imports in one indexing revision.
- Absence of a relationship is not proof that no runtime dependency exists.
- Semantic similarity and retrieval rank are not evidence of a dependency.
- Only import relationships can produce a module dependency.
- Modules are folder groupings. They are not deployment units, packages, or services.
- Technology statements come from manifest and configuration file names, or from cited source marked as inference.
- Brokers, traffic, and deployment topology are outside this feature.
