import { describe, expect, it } from 'vitest';
import type { DependencyMap, DependencyMapState } from '@/entities';
import {
  describeBound,
  describeConfidence,
  describeRevision,
  describeState,
  formatCount,
} from './dependency-map-presentation';

function dependencyMap(overrides: Partial<DependencyMap> = {}): DependencyMap {
  return {
    repositoryId: 'repo-1',
    repositoryStatus: 'READY',
    state: 'READY',
    revision: {
      indexingRunId: 'run-1',
      branch: 'main',
      commitSha: 'a1b2c3d4e5f6',
      completedAt: '2026-06-24T00:00:00.000Z',
    },
    rebuildInProgress: false,
    modules: [],
    moduleBounds: { limit: 40, returned: 0, total: 0, truncated: false },
    dependencies: [],
    dependencyBounds: { limit: 80, returned: 0, total: 0, truncated: false },
    focusedExplorationRequired: false,
    totals: {
      moduleCount: 0,
      dependencyCount: 0,
      resolvedRelationCount: 0,
      unresolvedRelationCount: 0,
      externalRelationCount: 0,
      internalRelationCount: 0,
      groupedFileCount: 0,
      excludedFileCount: 0,
    },
    exclusions: [],
    nonDependencyRelationCounts: [],
    groupingRules: [],
    limitations: [],
    partial: false,
    partialReasons: [],
    ...overrides,
  };
}

describe('describeConfidence', () => {
  it('gives each classification a distinct label and description', () => {
    const resolved = describeConfidence('RESOLVED');
    const unresolved = describeConfidence('UNRESOLVED');
    const external = describeConfidence('EXTERNAL');

    expect(resolved.label).toBe('Resolved');
    expect(unresolved.label).toBe('Unresolved');
    expect(external.label).toBe('External');

    const labels = [resolved.label, unresolved.label, external.label];
    expect(new Set(labels).size).toBe(3);

    const classNames = [resolved.className, unresolved.className, external.className];
    expect(new Set(classNames).size).toBe(3);
  });

  it('states that unresolved draws no dependency', () => {
    expect(describeConfidence('UNRESOLVED').description).toContain('No dependency is drawn');
  });

  it('states that external is outside the repository', () => {
    expect(describeConfidence('EXTERNAL').description).toContain('outside this repository');
  });
});

describe('describeState', () => {
  it('returns no notice for a ready view', () => {
    expect(describeState(dependencyMap())).toBeNull();
  });

  it('explains a repository that never completed indexing', () => {
    const state = describeState(dependencyMap({ state: 'NO_INDEX', revision: null }));

    expect(state?.title).toContain('not available');
    expect(state?.showsModules).toBe(false);
  });

  it('explains a first index still running', () => {
    const state = describeState(dependencyMap({ state: 'REBUILDING', revision: null }));

    expect(state?.title).toContain('Indexing in progress');
    expect(state?.showsModules).toBe(false);
  });

  it('explains a revision that produced no modules', () => {
    const state = describeState(dependencyMap({ state: 'NO_MODULES' }));

    expect(state?.title).toContain('No modules');
    expect(state?.description).toContain('grouping and exclusion rules');
    expect(state?.showsModules).toBe(false);
  });

  it('reports unresolved counts when no dependency could be established', () => {
    const state = describeState(
      dependencyMap({
        state: 'NO_DEPENDENCIES',
        totals: { ...dependencyMap().totals, unresolvedRelationCount: 7 },
      }),
    );

    expect(state?.description).toContain('7 relationships were left unresolved');
    expect(state?.description).toContain('does not mean the modules are independent');
    expect(state?.showsModules).toBe(true);
  });

  it('does not imply independence when there are no unresolved relationships either', () => {
    const state = describeState(dependencyMap({ state: 'NO_DEPENDENCIES' }));

    expect(state?.description).toContain('does not mean the modules are independent');
  });

  it('keeps modules visible for a partial view and surfaces the reason', () => {
    const state = describeState(
      dependencyMap({
        state: 'PARTIAL',
        partial: true,
        partialReasons: ['Too many relationships to load.'],
      }),
    );

    expect(state?.description).toBe('Too many relationships to load.');
    expect(state?.showsModules).toBe(true);
  });

  it('handles every state without throwing', () => {
    const states: DependencyMapState[] = [
      'READY',
      'NO_INDEX',
      'REBUILDING',
      'NO_MODULES',
      'NO_DEPENDENCIES',
      'PARTIAL',
    ];

    for (const state of states) {
      expect(() => describeState(dependencyMap({ state }))).not.toThrow();
    }
  });
});

describe('describeBound', () => {
  it('says nothing when a set was not truncated', () => {
    expect(
      describeBound({ limit: 40, returned: 12, total: 12, truncated: false }, 'modules'),
    ).toBeNull();
  });

  it('states what was shown, what was omitted and the declared limit', () => {
    const notice = describeBound(
      { limit: 40, returned: 40, total: 57, truncated: true },
      'modules',
    );

    expect(notice).toContain('top 40 of 57 modules');
    expect(notice).toContain('17 more are not shown');
    expect(notice).toContain('bounded at 40');
  });

  it('uses singular wording for a single omitted item', () => {
    const notice = describeBound(
      { limit: 25, returned: 25, total: 26, truncated: true },
      'dependencies',
    );

    expect(notice).toContain('1 more is not shown');
  });
});

describe('describeRevision', () => {
  it('shows the branch and a short commit', () => {
    expect(describeRevision(dependencyMap())).toBe('main · a1b2c3d');
  });

  it('falls back to the run id when branch and commit are missing', () => {
    const map = dependencyMap({
      revision: {
        indexingRunId: 'run-9',
        branch: null,
        commitSha: null,
        completedAt: null,
      },
    });

    expect(describeRevision(map)).toBe('Revision run-9');
  });

  it('reports when there is no revision at all', () => {
    expect(describeRevision(dependencyMap({ revision: null }))).toBe('No indexing revision');
  });
});

describe('formatCount', () => {
  it('pluralises based on the value', () => {
    expect(formatCount(1, 'file')).toBe('1 file');
    expect(formatCount(3, 'file')).toBe('3 files');
    expect(formatCount(0, 'file')).toBe('0 files');
  });

  it('accepts an explicit plural', () => {
    expect(formatCount(2, 'dependency', 'dependencies')).toBe('2 dependencies');
  });
});
