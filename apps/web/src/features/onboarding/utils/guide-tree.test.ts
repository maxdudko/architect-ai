import { describe, expect, it } from 'vitest';
import type { GuideType, OnboardingGuide } from '@/entities';
import { getDefaultGuide, groupGuides } from './guide-tree';

function guide(type: GuideType, title: string, id = `${type}-${title}`): OnboardingGuide {
  return {
    id,
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    type,
    slug: id.toLowerCase(),
    title,
    markdown: '',
    summary: null,
    metadata: null,
    generationVersion: 1,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
  };
}

describe('groupGuides', () => {
  it('groups guides in navigation order regardless of input order', () => {
    const groups = groupGuides([
      guide('GLOSSARY', 'Terms'),
      guide('SERVICE', 'Payments'),
      guide('EXECUTIVE_SUMMARY', 'At a glance'),
      guide('MODULE', 'Users'),
      guide('TECHNOLOGY_STACK', 'Technology'),
      guide('PROJECT_OVERVIEW', 'Project'),
      guide('READING_ORDER', 'Start here'),
      guide('FOLDER', 'Folders'),
    ]);

    expect(groups.map(({ label }) => label)).toEqual([
      'Overview',
      'Folders',
      'Modules',
      'Services',
      'Knowledge',
    ]);
    expect(groups.map(({ guides }) => guides.map(({ type }) => type))).toEqual([
      ['EXECUTIVE_SUMMARY', 'PROJECT_OVERVIEW', 'TECHNOLOGY_STACK'],
      ['FOLDER'],
      ['MODULE'],
      ['SERVICE'],
      ['READING_ORDER', 'GLOSSARY'],
    ]);
  });

  it('orders guides of the same type by title without mutating the input', () => {
    const guides = [
      guide('MODULE', 'Zebra', 'zebra'),
      guide('MODULE', 'Accounts', 'accounts'),
      guide('SERVICE', 'Worker', 'worker'),
    ];

    const groups = groupGuides(guides);

    expect(groups[0].guides.map(({ id }) => id)).toEqual(['accounts', 'zebra']);
    expect(guides.map(({ id }) => id)).toEqual(['zebra', 'accounts', 'worker']);
  });

  it('omits empty groups', () => {
    expect(groupGuides([guide('SERVICE', 'Payments')]).map(({ label }) => label)).toEqual([
      'Services',
    ]);
  });
});

describe('getDefaultGuide', () => {
  it('returns the first guide in grouped navigation order', () => {
    expect(
      getDefaultGuide([
        guide('SERVICE', 'Payments', 'service'),
        guide('PROJECT_OVERVIEW', 'Project', 'overview'),
        guide('EXECUTIVE_SUMMARY', 'Summary', 'summary'),
      ])?.id,
    ).toBe('summary');
  });

  it('returns undefined for an empty guide list', () => {
    expect(getDefaultGuide([])).toBeUndefined();
  });
});
