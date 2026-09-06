import { SearchFilterBuilder } from './search-filter.builder';

describe('SearchFilterBuilder', () => {
  it('builds workspace and repository isolation filters', () => {
    const filter = new SearchFilterBuilder()
      .workspace('ws-1')
      .repository(['repo-1', 'repo-2'])
      .language('typescript')
      .symbolType('CLASS')
      .branch('main')
      .indexingRun(['run-1', 'run-2'])
      .build();

    expect(filter.must).toEqual([
      { field: 'workspaceId', operator: 'eq', value: 'ws-1' },
      {
        field: 'repositoryId',
        operator: 'any',
        value: ['repo-1', 'repo-2'],
      },
      { field: 'language', operator: 'eq', value: 'typescript' },
      { field: 'symbolType', operator: 'eq', value: 'CLASS' },
      { field: 'branch', operator: 'eq', value: 'main' },
      {
        field: 'indexingRunId',
        operator: 'any',
        value: ['run-1', 'run-2'],
      },
    ]);
  });

  it('uses equality for a single repository', () => {
    const filter = new SearchFilterBuilder().repository('repo-1').build();
    expect(filter.must).toEqual([
      { field: 'repositoryId', operator: 'eq', value: 'repo-1' },
    ]);
  });

  it('uses equality for a single indexing run', () => {
    const filter = new SearchFilterBuilder().indexingRun('run-1').build();
    expect(filter.must).toEqual([
      { field: 'indexingRunId', operator: 'eq', value: 'run-1' },
    ]);
  });
});
