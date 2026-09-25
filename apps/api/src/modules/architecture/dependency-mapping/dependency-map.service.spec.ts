import { NotFoundException } from '@nestjs/common';
import { RepositoryStatus, SymbolRelationType } from '@prisma/client';
import type { PrismaArchitectureDataSource } from './data/prisma-architecture-data-source';
import { DEPENDENCY_MAP_LIMITS } from './dependency-map.constants';
import { DependencyMapService } from './dependency-map.service';
import type { DependencyGraphProvider } from './dependency-graph.provider';
import type {
  ArchitectureModuleNode,
  DependencyGraph,
  ModuleDependencyEdge,
} from './types/dependency-graph.type';

const WORKSPACE_ID = 'workspace-1';
const REPOSITORY_ID = 'repository-1';
const RUN_ID = 'run-1';

const REVISION = {
  indexingRunId: RUN_ID,
  branch: 'main',
  commitSha: 'abc123',
  completedAt: new Date('2026-06-24T00:00:00.000Z'),
};

function moduleNode(
  key: string,
  overrides: Partial<ArchitectureModuleNode> = {},
): ArchitectureModuleNode {
  return {
    key,
    name: key,
    path: key,
    fileCount: 2,
    symbolCount: 4,
    languages: ['typescript'],
    outgoingDependencyCount: 0,
    incomingDependencyCount: 0,
    internalRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    significance: 6,
    ...overrides,
  };
}

function edge(
  fromModuleKey: string,
  toModuleKey: string,
  overrides: Partial<ModuleDependencyEdge> = {},
): ModuleDependencyEdge {
  return {
    fromModuleKey,
    toModuleKey,
    relationTypes: [SymbolRelationType.IMPORTS],
    supportingRelationCount: 1,
    confidence: 'RESOLVED',
    evidence: [
      {
        sourceFilePath: `${fromModuleKey}/a.ts`,
        targetFilePath: `${toModuleKey}/b.ts`,
        relationType: SymbolRelationType.IMPORTS,
        observedTarget: `../${toModuleKey}/b`,
        targetName: 'b',
        strategy: 'RELATIVE_PATH',
      },
    ],
    evidenceTruncated: false,
    ...overrides,
  };
}

function graph(overrides: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    repositoryId: REPOSITORY_ID,
    indexingRunId: RUN_ID,
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
    ...overrides,
  };
}

describe('DependencyMapService', () => {
  let dataSource: jest.Mocked<PrismaArchitectureDataSource>;
  let graphProvider: jest.Mocked<DependencyGraphProvider>;
  let service: DependencyMapService;

  beforeEach(() => {
    dataSource = {
      findRepositoryInWorkspace: jest.fn(),
      findLatestSucceededRevision: jest.fn(),
      loadSnapshot: jest.fn(),
      listNotableSymbols: jest.fn().mockResolvedValue([]),
      listFilesByPath: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PrismaArchitectureDataSource>;

    graphProvider = {
      getGraph: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraphProvider>;

    service = new DependencyMapService(dataSource, graphProvider);

    dataSource.findRepositoryInWorkspace.mockResolvedValue({
      id: REPOSITORY_ID,
      status: RepositoryStatus.READY,
      fullName: 'acme/platform',
    });
    dataSource.findLatestSucceededRevision.mockResolvedValue(REVISION);
  });

  describe('workspace isolation', () => {
    it('rejects a repository outside the requesting workspace on every read', async () => {
      dataSource.findRepositoryInWorkspace.mockResolvedValue(null);

      await expect(
        service.getDependencyMap(WORKSPACE_ID, REPOSITORY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getModuleDetail(WORKSPACE_ID, REPOSITORY_ID, 'src/app'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getDependencyEvidence(
          WORKSPACE_ID,
          REPOSITORY_ID,
          'src/app',
          'src/shared',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(graphProvider.getGraph).not.toHaveBeenCalled();
    });

    it('does not distinguish a foreign repository from a missing one', async () => {
      dataSource.findRepositoryInWorkspace.mockResolvedValue(null);

      await expect(
        service.getDependencyMap(WORKSPACE_ID, REPOSITORY_ID),
      ).rejects.toThrow('Repository not found in this workspace');
    });
  });

  describe('states', () => {
    it('reports NO_INDEX when indexing never completed', async () => {
      dataSource.findLatestSucceededRevision.mockResolvedValue(null);

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('NO_INDEX');
      expect(result.revision).toBeNull();
      expect(result.modules).toEqual([]);
      expect(result.groupingRules.length).toBeGreaterThan(0);
    });

    it('reports REBUILDING when a first index is still running', async () => {
      dataSource.findRepositoryInWorkspace.mockResolvedValue({
        id: REPOSITORY_ID,
        status: RepositoryStatus.PARSING,
        fullName: 'acme/platform',
      });
      dataSource.findLatestSucceededRevision.mockResolvedValue(null);

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('REBUILDING');
      expect(result.rebuildInProgress).toBe(true);
    });

    it('keeps serving the previous revision while a rebuild runs', async () => {
      dataSource.findRepositoryInWorkspace.mockResolvedValue({
        id: REPOSITORY_ID,
        status: RepositoryStatus.CHUNKING,
        fullName: 'acme/platform',
      });
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/app'), moduleNode('src/shared')],
          dependencies: [edge('src/app', 'src/shared')],
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('READY');
      expect(result.rebuildInProgress).toBe(true);
      expect(result.revision?.indexingRunId).toBe(RUN_ID);
      expect(result.revision?.commitSha).toBe('abc123');
    });

    it('explains an indexed revision that produced no modules', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          exclusions: [
            { reason: 'Folder path matches an excluded pattern', fileCount: 9 },
          ],
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('NO_MODULES');
      expect(result.exclusions).toHaveLength(1);
      expect(result.groupingRules.length).toBeGreaterThan(0);
    });

    it('shows modules and unresolved counts when no dependency resolved', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/Http', { unresolvedRelationCount: 4 })],
          totals: {
            ...graph().totals,
            moduleCount: 1,
            unresolvedRelationCount: 4,
          },
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('NO_DEPENDENCIES');
      expect(result.modules).toHaveLength(1);
      expect(result.totals.unresolvedRelationCount).toBe(4);
    });

    it('reports a truncated derivation as partial', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/app'), moduleNode('src/shared')],
          dependencies: [edge('src/app', 'src/shared')],
          partial: true,
          partialReasons: ['truncated'],
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.state).toBe('PARTIAL');
      expect(result.partial).toBe(true);
    });
  });

  describe('bounded results', () => {
    it('bounds the module list and discloses the bound', async () => {
      const modules = Array.from(
        { length: DEPENDENCY_MAP_LIMITS.modulesPerView + 7 },
        (_, index) => moduleNode(`src/module-${index}`),
      );
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules,
          dependencies: [edge('src/module-0', 'src/module-1')],
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.modules).toHaveLength(DEPENDENCY_MAP_LIMITS.modulesPerView);
      expect(result.moduleBounds).toEqual({
        limit: DEPENDENCY_MAP_LIMITS.modulesPerView,
        returned: DEPENDENCY_MAP_LIMITS.modulesPerView,
        total: modules.length,
        truncated: true,
      });
      expect(result.focusedExplorationRequired).toBe(true);
    });

    it('returns edges whose both ends are in the visible module slice', async () => {
      const modules = Array.from(
        { length: DEPENDENCY_MAP_LIMITS.modulesPerView + 2 },
        (_, index) => moduleNode(`src/module-${index}`),
      );
      const hiddenKey = modules[modules.length - 1].key;
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules,
          dependencies: [
            edge('src/module-0', 'src/module-1', {
              supportingRelationCount: 4,
            }),
            edge('src/module-1', hiddenKey, { supportingRelationCount: 9 }),
            edge('src/module-0', 'src/module-2', {
              supportingRelationCount: 2,
            }),
          ],
        }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.dependencies.map((item) => item.toModuleKey)).toEqual([
        'src/module-1',
        'src/module-2',
      ]);
      expect(result.dependencies[0]).toEqual(
        expect.objectContaining({
          fromModuleKey: 'src/module-0',
          supportingRelationCount: 4,
          confidence: 'RESOLVED',
        }),
      );
      expect(result.dependencies[0]).not.toHaveProperty('evidence');
      expect(result.dependencyBounds).toEqual({
        limit: DEPENDENCY_MAP_LIMITS.edgesPerView,
        returned: 2,
        total: 2,
        truncated: false,
      });
    });

    it('bounds the repository edge list and discloses how many were omitted', async () => {
      const modules = Array.from({ length: 10 }, (_, index) =>
        moduleNode(`src/module-${index}`),
      );
      const dependencies = Array.from(
        { length: DEPENDENCY_MAP_LIMITS.edgesPerView + 3 },
        (_, index) =>
          edge('src/module-0', `src/module-${(index % 9) + 1}`, {
            supportingRelationCount: 100 - index,
          }),
      );

      graphProvider.getGraph.mockResolvedValue(
        graph({ modules, dependencies }),
      );

      const result = await service.getDependencyMap(
        WORKSPACE_ID,
        REPOSITORY_ID,
      );

      expect(result.dependencies).toHaveLength(
        DEPENDENCY_MAP_LIMITS.edgesPerView,
      );
      expect(result.dependencies[0].supportingRelationCount).toBe(100);
      expect(result.dependencyBounds).toEqual({
        limit: DEPENDENCY_MAP_LIMITS.edgesPerView,
        returned: DEPENDENCY_MAP_LIMITS.edgesPerView,
        total: dependencies.length,
        truncated: true,
      });
    });

    it('bounds dependencies and dependents of a selected module', async () => {
      const modules = [
        moduleNode('src/app'),
        ...Array.from(
          { length: DEPENDENCY_MAP_LIMITS.dependenciesPerModule + 3 },
          (_, index) => moduleNode(`src/target-${index}`),
        ),
      ];
      const dependencies = modules
        .slice(1)
        .map((target) => edge('src/app', target.key));

      graphProvider.getGraph.mockResolvedValue(
        graph({ modules, dependencies }),
      );

      const result = await service.getModuleDetail(
        WORKSPACE_ID,
        REPOSITORY_ID,
        'src/app',
      );

      expect(result.dependencies).toHaveLength(
        DEPENDENCY_MAP_LIMITS.dependenciesPerModule,
      );
      expect(result.dependencyBounds.truncated).toBe(true);
      expect(result.dependencyBounds.total).toBe(dependencies.length);
      expect(result.dependents).toHaveLength(0);
      expect(result.dependentBounds.truncated).toBe(false);
    });
  });

  describe('module detail', () => {
    it('splits dependencies from dependents and names the related module', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [
            moduleNode('src/app', { name: 'App' }),
            moduleNode('src/shared', { name: 'Shared' }),
            moduleNode('src/web', { name: 'Web' }),
          ],
          dependencies: [
            edge('src/app', 'src/shared'),
            edge('src/web', 'src/app'),
          ],
          filePathsByModule: { 'src/app': ['src/app/a.ts', 'src/app/b.ts'] },
        }),
      );

      const result = await service.getModuleDetail(
        WORKSPACE_ID,
        REPOSITORY_ID,
        'src/app',
      );

      expect(result.dependencies).toEqual([
        expect.objectContaining({
          relatedModuleKey: 'src/shared',
          relatedModuleName: 'Shared',
          confidence: 'RESOLVED',
        }),
      ]);
      expect(result.dependents).toEqual([
        expect.objectContaining({
          relatedModuleKey: 'src/web',
          relatedModuleName: 'Web',
        }),
      ]);
      expect(result.revision.indexingRunId).toBe(RUN_ID);
    });

    it('rejects an unknown module key', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({ modules: [moduleNode('src/app')] }),
      );

      await expect(
        service.getModuleDetail(WORKSPACE_ID, REPOSITORY_ID, 'src/missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('classifies unresolved records and attaches a stated reason', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/Http')],
          unresolved: [
            {
              moduleKey: 'src/Http',
              sourceFilePath: 'src/Http/Kernel.php',
              observedTarget: null,
              targetName: 'App\\Models\\User',
              relationType: SymbolRelationType.IMPORTS,
              reason: 'NO_TARGET_PATH_RECORDED',
              occurrenceCount: 3,
            },
          ],
        }),
      );

      const result = await service.getModuleDetail(
        WORKSPACE_ID,
        REPOSITORY_ID,
        'src/Http',
      );

      expect(result.unresolved).toEqual([
        expect.objectContaining({
          confidence: 'UNRESOLVED',
          targetName: 'App\\Models\\User',
          reason: 'NO_TARGET_PATH_RECORDED',
          reasonDescription: expect.stringContaining('no target path'),
          occurrenceCount: 3,
        }),
      ]);
    });

    it('classifies external targets without making them modules', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/app')],
          external: [
            {
              moduleKey: 'src/app',
              targetName: 'lodash',
              relationType: SymbolRelationType.IMPORTS,
              occurrenceCount: 5,
            },
          ],
        }),
      );

      const result = await service.getModuleDetail(
        WORKSPACE_ID,
        REPOSITORY_ID,
        'src/app',
      );

      expect(result.external).toEqual([
        expect.objectContaining({
          targetName: 'lodash',
          confidence: 'EXTERNAL',
        }),
      ]);
    });
  });

  describe('evidence', () => {
    it('returns source locations for a resolved dependency', async () => {
      graphProvider.getGraph.mockResolvedValue(
        graph({
          modules: [moduleNode('src/app'), moduleNode('src/shared')],
          dependencies: [edge('src/app', 'src/shared')],
        }),
      );

      const result = await service.getDependencyEvidence(
        WORKSPACE_ID,
        REPOSITORY_ID,
        'src/app',
        'src/shared',
      );

      expect(result.confidence).toBe('RESOLVED');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].source.filePath).toBe('src/app/a.ts');
      expect(result.items[0].target.filePath).toBe('src/shared/b.ts');
      expect(result.items[0].source.repositoryId).toBe(REPOSITORY_ID);
      expect(result.revision.indexingRunId).toBe(RUN_ID);
    });

    it('rejects a dependency that does not exist in this revision', async () => {
      graphProvider.getGraph.mockResolvedValue(graph({ dependencies: [] }));

      await expect(
        service.getDependencyEvidence(
          WORKSPACE_ID,
          REPOSITORY_ID,
          'src/app',
          'src/shared',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('derives every part of a view from one revision', async () => {
    graphProvider.getGraph.mockResolvedValue(
      graph({
        modules: [moduleNode('src/app')],
        filePathsByModule: { 'src/app': ['src/app/a.ts'] },
      }),
    );

    await service.getModuleDetail(WORKSPACE_ID, REPOSITORY_ID, 'src/app');

    expect(graphProvider.getGraph).toHaveBeenCalledWith(REPOSITORY_ID, RUN_ID);
    expect(dataSource.listFilesByPath).toHaveBeenCalledWith(
      REPOSITORY_ID,
      RUN_ID,
      ['src/app/a.ts'],
    );
    expect(dataSource.listNotableSymbols).toHaveBeenCalledWith(
      REPOSITORY_ID,
      RUN_ID,
      ['src/app/a.ts'],
      DEPENDENCY_MAP_LIMITS.symbolsPerModule,
    );
  });
});
