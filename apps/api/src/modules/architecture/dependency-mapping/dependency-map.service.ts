import { Injectable, NotFoundException } from '@nestjs/common';
import { RepositoryStatus } from '@prisma/client';
import { PrismaArchitectureDataSource } from './data/prisma-architecture-data-source';
import {
  DEPENDENCY_MAP_LIMITATIONS,
  DEPENDENCY_MAP_LIMITS,
  MODULE_GROUPING_RULES,
} from './dependency-map.constants';
import { DependencyGraphProvider } from './dependency-graph.provider';
import type {
  ArchitectureRevisionDto,
  BoundDisclosureDto,
  DependencyEvidenceResponseDto,
  DependencyMapEdgeDto,
  DependencyMapResponseDto,
  DependencyMapState,
  ExternalDependencyDto,
  ModuleDependencyDto,
  ModuleDetailResponseDto,
  ModuleSummaryDto,
  UnresolvedRelationshipDto,
} from './dto/dependency-map-response.dto';
import type { ArchitectureRevision } from './types/architecture-snapshot.type';
import {
  UNRESOLVED_REASON_DESCRIPTIONS,
  type ArchitectureModuleNode,
  type DependencyGraph,
  type ModuleDependencyEdge,
} from './types/dependency-graph.type';

/** Statuses that mean indexing work is currently running (spec ST-2). */
const PROCESSING_STATUSES: RepositoryStatus[] = [
  RepositoryStatus.PENDING,
  RepositoryStatus.CLONING,
  RepositoryStatus.PARSING,
  RepositoryStatus.CHUNKING,
  RepositoryStatus.EMBEDDING,
];

/**
 * Assembles bounded, revision-consistent dependency views.
 *
 * Each public method resolves the revision once and derives everything it
 * returns from that single revision, rather than letting each part
 * independently look up the latest successful run (spec IR-3, AC-12).
 */
@Injectable()
export class DependencyMapService {
  constructor(
    private readonly dataSource: PrismaArchitectureDataSource,
    private readonly graphProvider: DependencyGraphProvider,
  ) {}

  async getDependencyMap(
    workspaceId: string,
    repositoryId: string,
    query: { q?: string; indexingRunId?: string } = {},
  ): Promise<DependencyMapResponseDto> {
    const repository = await this.requireRepository(workspaceId, repositoryId);
    const { revision, newerRevisionAvailable } = await this.resolveViewRevision(
      repositoryId,
      query.indexingRunId,
    );
    const rebuildInProgress = PROCESSING_STATUSES.includes(repository.status);

    if (!revision) {
      return this.emptyMap(
        repositoryId,
        repository.status,
        rebuildInProgress ? 'REBUILDING' : 'NO_INDEX',
      );
    }

    const graph = await this.graphProvider.getGraph(
      repositoryId,
      revision.indexingRunId,
    );

    const matched = matchModules(graph.modules, query.q);
    const modules = matched.slice(0, DEPENDENCY_MAP_LIMITS.modulesPerView);
    const visibleModuleKeys = new Set(modules.map((module) => module.key));
    const visibleEdges = graph.dependencies.filter(
      (edge) =>
        visibleModuleKeys.has(edge.fromModuleKey) &&
        visibleModuleKeys.has(edge.toModuleKey),
    );
    const dependencies = visibleEdges.slice(
      0,
      DEPENDENCY_MAP_LIMITS.edgesPerView,
    );

    return {
      repositoryId,
      repositoryStatus: repository.status,
      state: resolveState(graph),
      revision: toRevisionDto(revision),
      rebuildInProgress,
      newerRevisionAvailable,
      modules: modules.map(toModuleSummary),
      moduleBounds: bounds(
        DEPENDENCY_MAP_LIMITS.modulesPerView,
        modules.length,
        matched.length,
      ),
      dependencies: dependencies.map(toOverviewEdge),
      dependencyBounds: bounds(
        DEPENDENCY_MAP_LIMITS.edgesPerView,
        dependencies.length,
        visibleEdges.length,
      ),
      focusedExplorationRequired:
        graph.modules.length > DEPENDENCY_MAP_LIMITS.modulesPerView,
      totals: graph.totals,
      exclusions: graph.exclusions,
      nonDependencyRelationCounts: graph.nonDependencyRelationCounts,
      groupingRules: [...MODULE_GROUPING_RULES],
      limitations: [...DEPENDENCY_MAP_LIMITATIONS],
      partial: graph.partial,
      partialReasons: graph.partialReasons,
    };
  }

  async getModuleDetail(
    workspaceId: string,
    repositoryId: string,
    moduleKey: string,
    indexingRunId?: string,
  ): Promise<ModuleDetailResponseDto> {
    const { graph, revision } = await this.requireGraph(
      workspaceId,
      repositoryId,
      indexingRunId,
    );

    const module = graph.modules.find((entry) => entry.key === moduleKey);
    if (!module) {
      throw new NotFoundException('Module not found in this indexing revision');
    }

    const moduleNameByKey = new Map(
      graph.modules.map((entry) => [entry.key, entry.name]),
    );

    const allDependencies = graph.dependencies.filter(
      (edge) => edge.fromModuleKey === moduleKey,
    );
    const allDependents = graph.dependencies.filter(
      (edge) => edge.toModuleKey === moduleKey,
    );
    const allUnresolved = graph.unresolved.filter(
      (record) => record.moduleKey === moduleKey,
    );
    const allExternal = graph.external.filter(
      (record) => record.moduleKey === moduleKey,
    );

    const dependencies = allDependencies.slice(
      0,
      DEPENDENCY_MAP_LIMITS.dependenciesPerModule,
    );
    const dependents = allDependents.slice(
      0,
      DEPENDENCY_MAP_LIMITS.dependentsPerModule,
    );
    const unresolved = allUnresolved.slice(
      0,
      DEPENDENCY_MAP_LIMITS.unresolvedTargetsPerModule,
    );
    const external = allExternal.slice(
      0,
      DEPENDENCY_MAP_LIMITS.externalTargetsPerModule,
    );

    const modulePaths = graph.filePathsByModule[moduleKey] ?? [];
    const pagedPaths = modulePaths.slice(
      0,
      DEPENDENCY_MAP_LIMITS.filesPerModule,
    );

    const [files, notableSymbols] = await Promise.all([
      this.dataSource.listFilesByPath(
        repositoryId,
        revision.indexingRunId,
        pagedPaths,
      ),
      this.dataSource.listNotableSymbols(
        repositoryId,
        revision.indexingRunId,
        modulePaths,
        DEPENDENCY_MAP_LIMITS.symbolsPerModule,
      ),
    ]);

    return {
      repositoryId,
      revision: toRevisionDto(revision),
      module: toModuleSummary(module),
      dependencies: dependencies.map((edge) =>
        toDependencyDto(edge, edge.toModuleKey, moduleNameByKey),
      ),
      dependencyBounds: bounds(
        DEPENDENCY_MAP_LIMITS.dependenciesPerModule,
        dependencies.length,
        allDependencies.length,
      ),
      dependents: dependents.map((edge) =>
        toDependencyDto(edge, edge.fromModuleKey, moduleNameByKey),
      ),
      dependentBounds: bounds(
        DEPENDENCY_MAP_LIMITS.dependentsPerModule,
        dependents.length,
        allDependents.length,
      ),
      unresolved: unresolved.map(toUnresolvedDto),
      unresolvedBounds: bounds(
        DEPENDENCY_MAP_LIMITS.unresolvedTargetsPerModule,
        unresolved.length,
        allUnresolved.length,
      ),
      external: external.map(toExternalDto),
      externalBounds: bounds(
        DEPENDENCY_MAP_LIMITS.externalTargetsPerModule,
        external.length,
        allExternal.length,
      ),
      files,
      fileBounds: bounds(
        DEPENDENCY_MAP_LIMITS.filesPerModule,
        files.length,
        modulePaths.length,
      ),
      notableSymbols: notableSymbols.symbols,
      symbolBounds: {
        limit: DEPENDENCY_MAP_LIMITS.symbolsPerModule,
        returned: notableSymbols.symbols.length,
        total: notableSymbols.total,
        truncated:
          notableSymbols.symbols.length < notableSymbols.total ||
          notableSymbols.lookupTruncated,
      },
      limitations: [...DEPENDENCY_MAP_LIMITATIONS],
    };
  }

  async getDependencyEvidence(
    workspaceId: string,
    repositoryId: string,
    fromModuleKey: string,
    toModuleKey: string,
    indexingRunId?: string,
  ): Promise<DependencyEvidenceResponseDto> {
    const { graph, revision } = await this.requireGraph(
      workspaceId,
      repositoryId,
      indexingRunId,
    );

    const edge = graph.dependencies.find(
      (candidate) =>
        candidate.fromModuleKey === fromModuleKey &&
        candidate.toModuleKey === toModuleKey,
    );

    if (!edge) {
      throw new NotFoundException(
        'Dependency not found in this indexing revision',
      );
    }

    const items = edge.evidence.slice(
      0,
      DEPENDENCY_MAP_LIMITS.evidencePerDependency,
    );

    return {
      repositoryId,
      revision: toRevisionDto(revision),
      fromModuleKey: edge.fromModuleKey,
      toModuleKey: edge.toModuleKey,
      relationTypes: edge.relationTypes,
      supportingRelationCount: edge.supportingRelationCount,
      confidence: edge.confidence,
      items: items.map((item) => ({
        source: {
          repositoryId,
          filePath: item.sourceFilePath,
          startLine: null,
          endLine: null,
          name: null,
          qualifiedName: null,
          relationType: item.relationType,
        },
        target: {
          repositoryId,
          filePath: item.targetFilePath,
          startLine: null,
          endLine: null,
          name: item.targetName,
          qualifiedName: item.targetName,
          relationType: item.relationType,
        },
        observedTarget: item.observedTarget,
        targetName: item.targetName,
        resolutionStrategy: item.strategy,
      })),
      bounds: bounds(
        DEPENDENCY_MAP_LIMITS.evidencePerDependency,
        items.length,
        edge.supportingRelationCount,
      ),
      limitations: [...DEPENDENCY_MAP_LIMITATIONS],
    };
  }

  private async requireRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<{ id: string; status: RepositoryStatus }> {
    const repository = await this.dataSource.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );

    if (!repository) {
      // Matches the existing convention: a repository outside the requesting
      // workspace is indistinguishable from one that does not exist (SEC-4).
      throw new NotFoundException('Repository not found in this workspace');
    }

    return repository;
  }

  private async requireGraph(
    workspaceId: string,
    repositoryId: string,
    indexingRunId?: string,
  ): Promise<{ graph: DependencyGraph; revision: ArchitectureRevision }> {
    await this.requireRepository(workspaceId, repositoryId);
    const { revision } = await this.resolveViewRevision(
      repositoryId,
      indexingRunId,
    );
    if (!revision) {
      throw new NotFoundException(
        'Repository has no successful indexing revision',
      );
    }

    const graph = await this.graphProvider.getGraph(
      repositoryId,
      revision.indexingRunId,
    );

    return { graph, revision };
  }

  /**
   * Picks one succeeded revision for the whole view. A requested run that is
   * gone falls back to the latest succeeded run instead of mixing data.
   */
  private async resolveViewRevision(
    repositoryId: string,
    indexingRunId?: string,
  ): Promise<{
    revision: ArchitectureRevision | null;
    newerRevisionAvailable: boolean;
  }> {
    const latest =
      await this.dataSource.findLatestSucceededRevision(repositoryId);
    const requested = indexingRunId?.trim();
    if (!requested) {
      return { revision: latest, newerRevisionAvailable: false };
    }

    const pinned = await this.dataSource.findSucceededRevision(
      repositoryId,
      requested,
    );
    if (!pinned) {
      return { revision: latest, newerRevisionAvailable: false };
    }

    return {
      revision: pinned,
      newerRevisionAvailable:
        latest !== null && latest.indexingRunId !== pinned.indexingRunId,
    };
  }

  private emptyMap(
    repositoryId: string,
    repositoryStatus: RepositoryStatus,
    state: DependencyMapState,
  ): DependencyMapResponseDto {
    return {
      repositoryId,
      repositoryStatus,
      state,
      revision: null,
      rebuildInProgress: state === 'REBUILDING',
      newerRevisionAvailable: false,
      modules: [],
      moduleBounds: bounds(DEPENDENCY_MAP_LIMITS.modulesPerView, 0, 0),
      dependencies: [],
      dependencyBounds: bounds(DEPENDENCY_MAP_LIMITS.edgesPerView, 0, 0),
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
      groupingRules: [...MODULE_GROUPING_RULES],
      limitations: [...DEPENDENCY_MAP_LIMITATIONS],
      partial: false,
      partialReasons: [],
    };
  }
}

function matchModules(
  modules: ArchitectureModuleNode[],
  query: string | undefined,
): ArchitectureModuleNode[] {
  const needle = query?.trim().toLowerCase() ?? '';
  if (!needle) {
    return modules;
  }
  return modules.filter(
    (module) =>
      module.path.toLowerCase().includes(needle) ||
      module.name.toLowerCase().includes(needle),
  );
}

function resolveState(graph: DependencyGraph): DependencyMapState {
  if (graph.modules.length === 0) {
    return 'NO_MODULES';
  }
  if (graph.dependencies.length === 0) {
    return 'NO_DEPENDENCIES';
  }
  if (graph.partial) {
    return 'PARTIAL';
  }
  return 'READY';
}

function bounds(
  limit: number,
  returned: number,
  total: number,
): BoundDisclosureDto {
  return { limit, returned, total, truncated: returned < total };
}

function toRevisionDto(
  revision: ArchitectureRevision,
): ArchitectureRevisionDto {
  return {
    indexingRunId: revision.indexingRunId,
    branch: revision.branch,
    commitSha: revision.commitSha,
    completedAt: revision.completedAt?.toISOString() ?? null,
  };
}

function toModuleSummary(module: ArchitectureModuleNode): ModuleSummaryDto {
  return { ...module };
}

function toOverviewEdge(edge: ModuleDependencyEdge): DependencyMapEdgeDto {
  return {
    fromModuleKey: edge.fromModuleKey,
    toModuleKey: edge.toModuleKey,
    relationTypes: edge.relationTypes,
    supportingRelationCount: edge.supportingRelationCount,
    confidence: edge.confidence,
  };
}

function toDependencyDto(
  edge: ModuleDependencyEdge,
  relatedModuleKey: string,
  moduleNameByKey: Map<string, string>,
): ModuleDependencyDto {
  return {
    fromModuleKey: edge.fromModuleKey,
    toModuleKey: edge.toModuleKey,
    relatedModuleKey,
    relatedModuleName:
      moduleNameByKey.get(relatedModuleKey) ?? relatedModuleKey,
    relationTypes: edge.relationTypes,
    supportingRelationCount: edge.supportingRelationCount,
    confidence: edge.confidence,
    evidenceAvailable: edge.evidence.length,
    evidenceTruncated: edge.evidenceTruncated,
  };
}

function toUnresolvedDto(
  record: DependencyGraph['unresolved'][number],
): UnresolvedRelationshipDto {
  return {
    moduleKey: record.moduleKey,
    sourceFilePath: record.sourceFilePath,
    observedTarget: record.observedTarget,
    targetName: record.targetName,
    relationType: record.relationType,
    reason: record.reason,
    reasonDescription: UNRESOLVED_REASON_DESCRIPTIONS[record.reason],
    occurrenceCount: record.occurrenceCount,
    confidence: 'UNRESOLVED',
  };
}

function toExternalDto(
  record: DependencyGraph['external'][number],
): ExternalDependencyDto {
  return {
    moduleKey: record.moduleKey,
    targetName: record.targetName,
    relationType: record.relationType,
    occurrenceCount: record.occurrenceCount,
    confidence: 'EXTERNAL',
  };
}
