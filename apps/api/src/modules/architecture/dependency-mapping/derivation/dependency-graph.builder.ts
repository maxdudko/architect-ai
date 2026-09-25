import { Injectable } from '@nestjs/common';
import type { SymbolRelationType } from '@prisma/client';
import { DEPENDENCY_MAP_LIMITS } from '../dependency-map.constants';
import type {
  ArchitectureSnapshot,
  ArchitectureSnapshotImport,
} from '../types/architecture-snapshot.type';
import type {
  ArchitectureModuleNode,
  DependencyEvidenceItem,
  DependencyGraph,
  ExternalDependencyRecord,
  ModuleDependencyEdge,
  UnresolvedReason,
  UnresolvedRelationshipRecord,
} from '../types/dependency-graph.type';
import { ModuleGrouperService } from './module-grouper.service';
import { RepositoryFileIndex } from './repository-file-index';
import { TargetResolverService } from './target-resolver.service';

interface EdgeAccumulator {
  fromModuleKey: string;
  toModuleKey: string;
  relationTypes: Set<SymbolRelationType>;
  supportingRelationCount: number;
  evidence: DependencyEvidenceItem[];
  evidenceTruncated: boolean;
}

interface UnresolvedAccumulator {
  moduleKey: string;
  sourceFilePath: string;
  observedTarget: string | null;
  targetName: string | null;
  relationType: SymbolRelationType;
  reason: UnresolvedReason;
  occurrenceCount: number;
}

interface ExternalAccumulator {
  moduleKey: string;
  targetName: string;
  relationType: SymbolRelationType;
  occurrenceCount: number;
}

/**
 * Turns one revision's snapshot into the directed module graph (spec FR-4).
 *
 * Only `IMPORTS` relationships reach this builder, because they are the only
 * extracted type carrying a target path (spec RS-5). Every relationship ends up
 * in exactly one bucket: a module dependency, module-internal activity, an
 * external target, or an unresolved record. Nothing is dropped silently.
 */
@Injectable()
export class DependencyGraphBuilder {
  constructor(
    private readonly moduleGrouper: ModuleGrouperService,
    private readonly targetResolver: TargetResolverService,
  ) {}

  build(snapshot: ArchitectureSnapshot): DependencyGraph {
    const grouping = this.moduleGrouper.group(
      snapshot.files,
      snapshot.symbolCountsByFile,
    );
    const fileIndex = new RepositoryFileIndex(snapshot.files);
    const languageByFilePath = new Map(
      snapshot.files.map((file) => [file.path, file.language]),
    );

    const edges = new Map<string, EdgeAccumulator>();
    const unresolved = new Map<string, UnresolvedAccumulator>();
    const external = new Map<string, ExternalAccumulator>();
    const internalCountByModule = new Map<string, number>();

    let resolvedRelationCount = 0;
    let unresolvedRelationCount = 0;
    let externalRelationCount = 0;
    let internalRelationCount = 0;

    for (const relation of dedupeImports(snapshot.imports)) {
      const fromModuleKey = grouping.moduleKeyByFilePath.get(
        relation.sourceFilePath,
      );
      if (!fromModuleKey) {
        // The source file was excluded from grouping, so the relationship has
        // no module to be displayed under.
        continue;
      }

      const resolution = this.targetResolver.resolve(
        {
          sourceFilePath: relation.sourceFilePath,
          observedTarget: relation.observedTarget,
          language:
            languageByFilePath.get(relation.sourceFilePath) ?? 'unknown',
        },
        fileIndex,
      );

      if (resolution.kind === 'EXTERNAL') {
        externalRelationCount += 1;
        accumulateExternal(external, {
          moduleKey: fromModuleKey,
          targetName: resolution.targetName,
          relationType: relation.relationType,
          occurrenceCount: 1,
        });
        continue;
      }

      if (resolution.kind === 'UNRESOLVED') {
        unresolvedRelationCount += 1;
        accumulateUnresolved(unresolved, {
          moduleKey: fromModuleKey,
          sourceFilePath: relation.sourceFilePath,
          observedTarget: relation.observedTarget,
          targetName: relation.targetName,
          relationType: relation.relationType,
          reason: resolution.reason,
          occurrenceCount: 1,
        });
        continue;
      }

      const toModuleKey = grouping.moduleKeyByFilePath.get(resolution.filePath);

      if (!toModuleKey) {
        unresolvedRelationCount += 1;
        accumulateUnresolved(unresolved, {
          moduleKey: fromModuleKey,
          sourceFilePath: relation.sourceFilePath,
          observedTarget: relation.observedTarget,
          targetName: relation.targetName,
          relationType: relation.relationType,
          reason: 'TARGET_MODULE_EXCLUDED',
          occurrenceCount: 1,
        });
        continue;
      }

      if (toModuleKey === fromModuleKey) {
        internalRelationCount += 1;
        internalCountByModule.set(
          fromModuleKey,
          (internalCountByModule.get(fromModuleKey) ?? 0) + 1,
        );
        continue;
      }

      resolvedRelationCount += 1;
      accumulateEdge(edges, fromModuleKey, toModuleKey, relation, {
        sourceFilePath: relation.sourceFilePath,
        targetFilePath: resolution.filePath,
        relationType: relation.relationType,
        observedTarget: relation.observedTarget,
        targetName: relation.targetName,
        strategy: resolution.strategy,
      });
    }

    const dependencies = [...edges.values()]
      .map((edge) => ({
        fromModuleKey: edge.fromModuleKey,
        toModuleKey: edge.toModuleKey,
        relationTypes: [...edge.relationTypes].sort(),
        supportingRelationCount: edge.supportingRelationCount,
        confidence: 'RESOLVED' as const,
        evidence: edge.evidence,
        evidenceTruncated: edge.evidenceTruncated,
      }))
      .sort(
        (left, right) =>
          right.supportingRelationCount - left.supportingRelationCount ||
          left.fromModuleKey.localeCompare(right.fromModuleKey) ||
          left.toModuleKey.localeCompare(right.toModuleKey),
      );

    const modules = this.buildModuleNodes(
      grouping.modules,
      dependencies,
      unresolved,
      external,
      internalCountByModule,
    );

    const filePathsByModule: Record<string, string[]> = {};
    for (const module of grouping.modules) {
      filePathsByModule[module.key] = module.filePaths;
    }

    return {
      repositoryId: snapshot.repositoryId,
      indexingRunId: snapshot.indexingRunId,
      modules,
      filePathsByModule,
      dependencies,
      unresolved: sortUnresolved([...unresolved.values()]),
      external: sortExternal([...external.values()]),
      exclusions: grouping.exclusions,
      nonDependencyRelationCounts: [...snapshot.nonImportRelationCounts].sort(
        (left, right) => left.relationType.localeCompare(right.relationType),
      ),
      totals: {
        moduleCount: modules.length,
        dependencyCount: dependencies.length,
        resolvedRelationCount,
        unresolvedRelationCount,
        externalRelationCount,
        internalRelationCount,
        groupedFileCount: grouping.groupedFileCount,
        excludedFileCount: grouping.excludedFileCount,
      },
      partial: snapshot.filesTruncated || snapshot.importsTruncated,
      partialReasons: buildPartialReasons(snapshot),
    };
  }

  private buildModuleNodes(
    grouped: ReturnType<ModuleGrouperService['group']>['modules'],
    dependencies: ModuleDependencyEdge[],
    unresolved: Map<string, UnresolvedAccumulator>,
    external: Map<string, ExternalAccumulator>,
    internalCountByModule: Map<string, number>,
  ): ArchitectureModuleNode[] {
    const outgoing = new Map<string, number>();
    const incoming = new Map<string, number>();
    for (const dependency of dependencies) {
      outgoing.set(
        dependency.fromModuleKey,
        (outgoing.get(dependency.fromModuleKey) ?? 0) + 1,
      );
      incoming.set(
        dependency.toModuleKey,
        (incoming.get(dependency.toModuleKey) ?? 0) + 1,
      );
    }

    const unresolvedByModule = new Map<string, number>();
    for (const record of unresolved.values()) {
      unresolvedByModule.set(
        record.moduleKey,
        (unresolvedByModule.get(record.moduleKey) ?? 0) +
          record.occurrenceCount,
      );
    }

    const externalByModule = new Map<string, number>();
    for (const record of external.values()) {
      externalByModule.set(
        record.moduleKey,
        (externalByModule.get(record.moduleKey) ?? 0) + record.occurrenceCount,
      );
    }

    return grouped
      .map((module) => {
        const outgoingDependencyCount = outgoing.get(module.key) ?? 0;
        const incomingDependencyCount = incoming.get(module.key) ?? 0;
        return {
          key: module.key,
          name: module.name,
          path: module.path,
          fileCount: module.fileCount,
          symbolCount: module.symbolCount,
          languages: module.languages,
          outgoingDependencyCount,
          incomingDependencyCount,
          internalRelationCount: internalCountByModule.get(module.key) ?? 0,
          unresolvedRelationCount: unresolvedByModule.get(module.key) ?? 0,
          externalRelationCount: externalByModule.get(module.key) ?? 0,
          significance:
            module.fileCount +
            module.symbolCount +
            outgoingDependencyCount +
            incomingDependencyCount,
        };
      })
      .sort(
        (left, right) =>
          right.significance - left.significance ||
          left.key.localeCompare(right.key),
      );
  }
}

/**
 * A single import statement produces one relationship row per identifier it
 * mentions, all sharing the same specifier. Collapsing them keeps supporting
 * counts honest (spec FR-4). Rows without a specifier are deduplicated by the
 * observed name instead, so PHP `use` and plain Python `import` statements keep
 * the target names needed for unresolved evidence (spec EV-5).
 */
function dedupeImports(
  imports: ArchitectureSnapshotImport[],
): ArchitectureSnapshotImport[] {
  const seen = new Set<string>();
  const deduped: ArchitectureSnapshotImport[] = [];

  for (const relation of imports) {
    const discriminator = relation.observedTarget
      ? `path:${relation.observedTarget}`
      : `name:${relation.targetName ?? ''}`;
    const key = `${relation.relationType}\u0000${relation.sourceFilePath}\u0000${discriminator}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(relation);
  }

  return deduped;
}

function accumulateEdge(
  edges: Map<string, EdgeAccumulator>,
  fromModuleKey: string,
  toModuleKey: string,
  relation: ArchitectureSnapshotImport,
  evidence: DependencyEvidenceItem,
): void {
  const key = `${fromModuleKey}\u0000${toModuleKey}`;
  const existing = edges.get(key);

  if (!existing) {
    edges.set(key, {
      fromModuleKey,
      toModuleKey,
      relationTypes: new Set([relation.relationType]),
      supportingRelationCount: 1,
      evidence: [evidence],
      evidenceTruncated: false,
    });
    return;
  }

  existing.relationTypes.add(relation.relationType);
  existing.supportingRelationCount += 1;
  if (existing.evidence.length < DEPENDENCY_MAP_LIMITS.evidencePerDependency) {
    existing.evidence.push(evidence);
  } else {
    existing.evidenceTruncated = true;
  }
}

function accumulateUnresolved(
  records: Map<string, UnresolvedAccumulator>,
  record: UnresolvedAccumulator,
): void {
  const key = `${record.moduleKey}\u0000${record.relationType}\u0000${record.reason}\u0000${record.observedTarget ?? record.targetName ?? ''}`;
  const existing = records.get(key);
  if (existing) {
    existing.occurrenceCount += record.occurrenceCount;
    return;
  }
  records.set(key, { ...record });
}

function accumulateExternal(
  records: Map<string, ExternalAccumulator>,
  record: ExternalAccumulator,
): void {
  const key = `${record.moduleKey}\u0000${record.relationType}\u0000${record.targetName}`;
  const existing = records.get(key);
  if (existing) {
    existing.occurrenceCount += record.occurrenceCount;
    return;
  }
  records.set(key, { ...record });
}

function sortUnresolved(
  records: UnresolvedAccumulator[],
): UnresolvedRelationshipRecord[] {
  return records.sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      left.moduleKey.localeCompare(right.moduleKey) ||
      (left.observedTarget ?? left.targetName ?? '').localeCompare(
        right.observedTarget ?? right.targetName ?? '',
      ),
  );
}

function sortExternal(
  records: ExternalAccumulator[],
): ExternalDependencyRecord[] {
  return records.sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      left.moduleKey.localeCompare(right.moduleKey) ||
      left.targetName.localeCompare(right.targetName),
  );
}

function buildPartialReasons(snapshot: ArchitectureSnapshot): string[] {
  const reasons: string[] = [];
  if (snapshot.filesTruncated) {
    reasons.push(
      'This revision has more indexed files than the derivation limit, so grouping used a truncated file set.',
    );
  }
  if (snapshot.importsTruncated) {
    reasons.push(
      'This revision has more import relationships than the derivation limit, so dependencies were derived from a truncated relationship set.',
    );
  }
  return reasons;
}
