import { InMemoryDependencyMapCache } from './cache/in-memory-dependency-map.cache';
import type { PrismaArchitectureDataSource } from './data/prisma-architecture-data-source';
import { DependencyGraphProvider } from './dependency-graph.provider';
import type { DependencyGraphBuilder } from './derivation/dependency-graph.builder';
import type { ArchitectureSnapshot } from './types/architecture-snapshot.type';
import type { DependencyGraph } from './types/dependency-graph.type';

const REPOSITORY_ID = 'repository-1';

function snapshotFor(indexingRunId: string): ArchitectureSnapshot {
  return {
    repositoryId: REPOSITORY_ID,
    indexingRunId,
    files: [],
    symbolCountsByFile: [],
    imports: [],
    nonImportRelationCounts: [],
    filesTruncated: false,
    importsTruncated: false,
  };
}

function graphFor(indexingRunId: string): DependencyGraph {
  return {
    repositoryId: REPOSITORY_ID,
    indexingRunId,
    modules: [],
    filePathsByModule: {},
    dependencies: [],
    unresolved: [],
    external: [],
    exclusions: [],
    nonDependencyRelationCounts: [],
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
    partial: false,
    partialReasons: [],
  };
}

describe('DependencyGraphProvider', () => {
  let dataSource: jest.Mocked<PrismaArchitectureDataSource>;
  let builder: jest.Mocked<DependencyGraphBuilder>;
  let cache: InMemoryDependencyMapCache;
  let provider: DependencyGraphProvider;

  beforeEach(() => {
    dataSource = {
      loadSnapshot: jest
        .fn()
        .mockImplementation((_repositoryId: string, runId: string) =>
          Promise.resolve(snapshotFor(runId)),
        ),
    } as unknown as jest.Mocked<PrismaArchitectureDataSource>;

    builder = {
      build: jest
        .fn()
        .mockImplementation((snapshot: ArchitectureSnapshot) =>
          graphFor(snapshot.indexingRunId),
        ),
    } as unknown as jest.Mocked<DependencyGraphBuilder>;

    cache = new InMemoryDependencyMapCache();
    provider = new DependencyGraphProvider(dataSource, builder, cache);
  });

  it('derives once and serves the cached graph afterwards', async () => {
    await provider.getGraph(REPOSITORY_ID, 'run-1');
    await provider.getGraph(REPOSITORY_ID, 'run-1');

    expect(dataSource.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(builder.build).toHaveBeenCalledTimes(1);
  });

  it('collapses concurrent requests for the same revision into one derivation', async () => {
    const [first, second, third] = await Promise.all([
      provider.getGraph(REPOSITORY_ID, 'run-1'),
      provider.getGraph(REPOSITORY_ID, 'run-1'),
      provider.getGraph(REPOSITORY_ID, 'run-1'),
    ]);

    expect(dataSource.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('derives a new graph when the revision changes, never mixing the two', async () => {
    const first = await provider.getGraph(REPOSITORY_ID, 'run-1');
    const second = await provider.getGraph(REPOSITORY_ID, 'run-2');

    expect(first.indexingRunId).toBe('run-1');
    expect(second.indexingRunId).toBe('run-2');
    expect(dataSource.loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per repository', async () => {
    await provider.getGraph(REPOSITORY_ID, 'run-1');
    await provider.getGraph('repository-2', 'run-1');

    expect(dataSource.loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it('does not leave a failed derivation in flight', async () => {
    dataSource.loadSnapshot.mockRejectedValueOnce(new Error('database down'));

    await expect(provider.getGraph(REPOSITORY_ID, 'run-1')).rejects.toThrow(
      'database down',
    );

    await expect(
      provider.getGraph(REPOSITORY_ID, 'run-1'),
    ).resolves.toMatchObject({ indexingRunId: 'run-1' });
    expect(dataSource.loadSnapshot).toHaveBeenCalledTimes(2);
  });
});
