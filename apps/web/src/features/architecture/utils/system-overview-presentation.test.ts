import { describe, expect, it } from 'vitest';
import type { SystemOverview } from '@/entities';
import {
  describeOverviewAvailability,
  describeOverviewProgress,
  linkCitedPaths,
} from './system-overview-presentation';

function overview(overrides: Partial<SystemOverview> = {}): SystemOverview {
  return {
    repositoryId: 'repo-1',
    repositoryStatus: 'READY',
    indexingAvailable: true,
    generationAllowed: true,
    rebuildInProgress: false,
    latestRevision: {
      indexingRunId: 'index-1',
      branch: 'main',
      commitSha: 'abc',
      completedAt: null,
    },
    overview: null,
    run: null,
    ...overrides,
  };
}

describe('system overview presentation', () => {
  it('explains when indexing has not produced an overview', () => {
    const state = describeOverviewAvailability(
      overview({ indexingAvailable: false, generationAllowed: false }),
    );
    expect(state?.title).toBe('System overview is unavailable');
  });

  it('offers generation when the repository is ready and no overview exists', () => {
    const state = describeOverviewAvailability(overview());
    expect(state?.title).toBe('No system overview yet');
  });

  it('keeps a document visible while a replacement is in progress', () => {
    const current = overview({
      overview: {
        id: 'overview-1',
        title: 'Overview',
        markdown: '# Overview',
        summary: null,
        revision: {
          indexingRunId: 'index-1',
          branch: 'main',
          commitSha: 'abc',
          completedAt: null,
        },
        generatedAt: '2026-09-02T00:00:00.000Z',
        generationVersion: 1,
        stale: false,
        citedPaths: [],
        partial: false,
        modulesAbsent: false,
      },
      run: {
        id: 'run-2',
        status: 'RUNNING',
        trigger: 'MANUAL_REGENERATE',
        completedStep: 2,
        totalSteps: 4,
        error: null,
        revision: null,
        createdAt: '2026-09-02T01:00:00.000Z',
        startedAt: '2026-09-02T01:00:00.000Z',
        completedAt: null,
      },
    });

    expect(describeOverviewAvailability(current)).toBeNull();
    expect(describeOverviewProgress(current)).toContain('Step 2 of 4');
    expect(describeOverviewProgress(current)).toContain('previous overview stays available');
  });

  it('turns cited paths into repository links that return to the overview', () => {
    const linked = linkCitedPaths(
      'See `src/billing/invoice.ts` and `src/billing/invoice.ts.bak`.',
      'repo-1',
      ['src/billing/invoice.ts', 'src/billing/invoice.ts.bak'],
    );

    expect(linked).toContain(
      '/repositories/repo-1?file=src%2Fbilling%2Finvoice.ts&returnTo=%2Frepositories%2Frepo-1%2Farchitecture%2Foverview',
    );
    expect(linked).toContain('src/billing/invoice.ts.bak');
    expect(linked).not.toContain('`src/billing/invoice.ts`');
  });
});
