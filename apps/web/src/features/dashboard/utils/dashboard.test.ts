import { describe, expect, it } from 'vitest';
import type { Repository, RepositoryStatus } from '@/entities';
import {
  formatGuideCountLabel,
  formatGuideCoverageSummary,
  formatRelativeTime,
  formatRepositoryStatusSummary,
  getRecentItems,
  summarizeGuideCoverage,
  summarizeRepositoryStatuses,
} from './dashboard';

function buildRepository(status: RepositoryStatus): Repository {
  return {
    id: `repo-${status}`,
    workspaceId: 'workspace-1',
    provider: 'GITHUB',
    externalId: '1',
    owner: 'acme',
    name: 'api',
    fullName: 'acme/api',
    defaultBranch: 'main',
    status,
    lastIndexedAt: null,
    indexingError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('summarizeRepositoryStatuses', () => {
  it('groups statuses into ready, indexing, and failed buckets', () => {
    const repositories = (
      ['READY', 'READY', 'FAILED', 'PENDING', 'CLONING', 'EMBEDDING'] as const
    ).map(buildRepository);

    expect(summarizeRepositoryStatuses(repositories)).toEqual({
      ready: 2,
      indexing: 3,
      failed: 1,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(summarizeRepositoryStatuses([])).toEqual({ ready: 0, indexing: 0, failed: 0 });
  });
});

describe('formatRepositoryStatusSummary', () => {
  it('joins non-zero buckets', () => {
    expect(formatRepositoryStatusSummary({ ready: 2, indexing: 1, failed: 0 })).toBe(
      '2 ready · 1 indexing',
    );
  });

  it('falls back when all buckets are zero', () => {
    expect(formatRepositoryStatusSummary({ ready: 0, indexing: 0, failed: 0 })).toBe(
      'No repositories connected',
    );
  });
});

describe('getRecentItems', () => {
  it('sorts by updatedAt descending and slices to the limit', () => {
    const items = [
      { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-03-01T00:00:00.000Z' },
      { id: 'c', updatedAt: '2026-02-01T00:00:00.000Z' },
    ];

    expect(getRecentItems(items, 2).map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('does not mutate the input array', () => {
    const items = [
      { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-03-01T00:00:00.000Z' },
    ];

    getRecentItems(items, 1);

    expect(items.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('summarizeGuideCoverage', () => {
  it('counts ready repositories, covered repositories, and total guides', () => {
    expect(
      summarizeGuideCoverage([{ guideCount: 8 }, { guideCount: 0 }, { guideCount: 3 }]),
    ).toEqual({
      readyRepositories: 3,
      withGuides: 2,
      totalGuides: 11,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(summarizeGuideCoverage([])).toEqual({
      readyRepositories: 0,
      withGuides: 0,
      totalGuides: 0,
    });
  });
});

describe('formatGuideCoverageSummary', () => {
  it('describes coverage when guides exist', () => {
    expect(
      formatGuideCoverageSummary({
        readyRepositories: 3,
        withGuides: 2,
        totalGuides: 11,
      }),
    ).toBe('2 of 3 ready have guides · 11 total');
  });

  it('describes ready repositories with no guides yet', () => {
    expect(
      formatGuideCoverageSummary({
        readyRepositories: 2,
        withGuides: 0,
        totalGuides: 0,
      }),
    ).toBe('2 ready · no guides yet');
  });

  it('falls back when there are no ready repositories', () => {
    expect(
      formatGuideCoverageSummary({
        readyRepositories: 0,
        withGuides: 0,
        totalGuides: 0,
      }),
    ).toBe('No indexed repositories yet');
  });
});

describe('formatGuideCountLabel', () => {
  it('formats singular and plural guide counts', () => {
    expect(formatGuideCountLabel(0)).toBe('No guides yet');
    expect(formatGuideCountLabel(1)).toBe('1 guide');
    expect(formatGuideCountLabel(4)).toBe('4 guides');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');

  it('formats minutes in the past', () => {
    expect(formatRelativeTime('2026-07-26T11:55:00.000Z', now)).toBe('5 minutes ago');
  });

  it('formats hours in the past', () => {
    expect(formatRelativeTime('2026-07-26T09:00:00.000Z', now)).toBe('3 hours ago');
  });

  it('formats days in the past', () => {
    expect(formatRelativeTime('2026-07-24T12:00:00.000Z', now)).toBe('2 days ago');
  });
});
