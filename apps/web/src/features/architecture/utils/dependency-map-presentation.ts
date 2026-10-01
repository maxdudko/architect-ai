import type {
  BoundDisclosure,
  DependencyConfidence,
  DependencyMap,
  DependencyMapState,
} from '@/entities';

export interface ConfidencePresentation {
  label: string;
  description: string;
  className: string;
}

/**
 * Confidence is shown wherever a relationship is displayed, not only in a
 * detail view, and unresolved and external must stay distinguishable from
 * resolved both visually and in text.
 */
const CONFIDENCE_PRESENTATION: Record<DependencyConfidence, ConfidencePresentation> = {
  RESOLVED: {
    label: 'Resolved',
    description:
      'The target was attributed to a specific file in this revision, so the dependency has a concrete source location.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  UNRESOLVED: {
    label: 'Unresolved',
    description:
      'A relationship was observed in source, but its target could not be attributed to a file in this repository. No dependency is drawn.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  EXTERNAL: {
    label: 'External',
    description:
      'The target was identified as something outside this repository, so no internal dependency is drawn.',
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
};

export function describeConfidence(confidence: DependencyConfidence): ConfidencePresentation {
  return CONFIDENCE_PRESENTATION[confidence] ?? CONFIDENCE_PRESENTATION.UNRESOLVED;
}

export interface StatePresentation {
  title: string;
  description: string;
  /** True when the surface should still render modules underneath the notice. */
  showsModules: boolean;
}

/**
 * Copy for every empty, processing and partial state. Each one explains the
 * limitation rather than leaving an empty view that would imply independence.
 */
export function describeState(map: DependencyMap): StatePresentation | null {
  const state: DependencyMapState = map.state;

  if (state === 'NO_INDEX') {
    return {
      title: 'Architecture data is not available yet',
      description:
        'This repository has never completed an indexing run, so no modules or dependencies could be derived. Check the repository indexing state to continue.',
      showsModules: false,
    };
  }

  if (state === 'REBUILDING') {
    return {
      title: 'Indexing in progress',
      description:
        'The first indexing run for this repository is still running. Architecture data appears once a run completes successfully.',
      showsModules: false,
    };
  }

  if (state === 'NO_MODULES') {
    return {
      title: 'No modules could be identified',
      description:
        'The indexed revision produced no groupable files. The grouping and exclusion rules below explain why.',
      showsModules: false,
    };
  }

  if (state === 'NO_DEPENDENCIES') {
    return {
      title: 'No dependencies could be established',
      description:
        map.totals.unresolvedRelationCount > 0
          ? `Modules were identified, but none of the observed relationships could be attributed to another module. ${map.totals.unresolvedRelationCount} relationship${map.totals.unresolvedRelationCount === 1 ? ' was' : 's were'} left unresolved. This does not mean the modules are independent.`
          : 'Modules were identified, but no relationship between them was found in this revision. This does not mean the modules are independent.',
      showsModules: true,
    };
  }

  if (state === 'PARTIAL') {
    return {
      title: 'Partial view',
      description:
        map.partialReasons.join(' ') ||
        'Part of this revision exceeded the derivation limit, so the view was built from a truncated input.',
      showsModules: true,
    };
  }

  return null;
}

/** Wording for a bounded set, used wherever a list was truncated. */
export function describeBound(bound: BoundDisclosure, noun: string): string | null {
  if (!bound.truncated) {
    return null;
  }
  const omitted = bound.total - bound.returned;
  if (omitted <= 0) {
    return `Showing ${bound.returned} ${noun}. The lookup was bounded, so this list may be incomplete.`;
  }
  return `Showing the top ${bound.returned} of ${bound.total} ${noun}. ${omitted} more ${omitted === 1 ? 'is' : 'are'} not shown; this view is bounded at ${bound.limit}.`;
}

/** Dependency map URL, optionally with the selected module restored. */
export function architectureMapHref(repositoryId: string, moduleKey: string | null): string {
  if (!moduleKey) {
    return `/repositories/${repositoryId}/architecture`;
  }
  return `/repositories/${repositoryId}/architecture?${new URLSearchParams({ module: moduleKey }).toString()}`;
}

/** File browser URL that returns to the dependency map, optionally on one module. */
export function architectureFileHref(
  repositoryId: string,
  filePath: string,
  moduleKey: string | null,
): string {
  return `/repositories/${repositoryId}?${new URLSearchParams({
    file: filePath,
    returnTo: architectureMapHref(repositoryId, moduleKey),
  }).toString()}`;
}

/**
 * Accepts a return path only when it is this repository's architecture page.
 * The map may carry a single `module` query. Search and overview may not.
 */
export function safeArchitectureReturnPath(
  repositoryId: string,
  returnTo: string | null,
): string | null {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(returnTo, 'http://architect.local');
  } catch {
    return null;
  }
  if (url.origin !== 'http://architect.local') {
    return null;
  }
  const mapPath = `/repositories/${repositoryId}/architecture`;
  if (url.pathname === `${mapPath}/search` || url.pathname === `${mapPath}/overview`) {
    return url.search ? null : url.pathname;
  }
  if (url.pathname !== mapPath) {
    return null;
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== 'module') || url.searchParams.getAll('module').length > 1) {
    return null;
  }
  return `${url.pathname}${url.search}`;
}

/** Short revision label for the header, e.g. "main · a1b2c3d". */
export function describeRevision(map: DependencyMap): string {
  if (!map.revision) {
    return 'No indexing revision';
  }
  const parts: string[] = [];
  if (map.revision.branch) {
    parts.push(map.revision.branch);
  }
  if (map.revision.commitSha) {
    parts.push(map.revision.commitSha.slice(0, 7));
  }
  return parts.length > 0 ? parts.join(' · ') : `Revision ${map.revision.indexingRunId}`;
}

export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
