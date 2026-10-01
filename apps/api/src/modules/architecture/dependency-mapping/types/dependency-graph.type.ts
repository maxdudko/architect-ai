import type { SymbolRelationType } from '@prisma/client';

/**
 * Confidence classification for anything the feature displays (spec RS-4).
 * A classification is never upgraded by name or semantic similarity.
 */
export type DependencyConfidence = 'RESOLVED' | 'UNRESOLVED' | 'EXTERNAL';

/**
 * Stated categories for why a relationship target could not be attributed to a
 * module in this repository (spec FR-6).
 */
export type UnresolvedReason =
  | 'NO_TARGET_PATH_RECORDED'
  | 'RELATIVE_PATH_NOT_FOUND'
  | 'ALIAS_UNRESOLVED'
  | 'AMBIGUOUS_MATCH'
  | 'TARGET_MODULE_EXCLUDED';

export const UNRESOLVED_REASON_DESCRIPTIONS: Record<UnresolvedReason, string> =
  {
    NO_TARGET_PATH_RECORDED:
      'The indexing result recorded no target path for this relationship, so no file could be looked up.',
    RELATIVE_PATH_NOT_FOUND:
      'The relative path in the import does not match any indexed file in this revision.',
    ALIAS_UNRESOLVED:
      'The import specifier looks like an internal alias but matches no indexed file path.',
    AMBIGUOUS_MATCH:
      'The import specifier matches more than one indexed file, so no single target could be chosen.',
    TARGET_MODULE_EXCLUDED:
      'The target file was found but belongs to no module, because its folder was excluded from grouping.',
  };

/** How a resolved target was matched, retained for evidence and auditing. */
export type ResolutionStrategy =
  | 'RELATIVE_PATH'
  | 'PATH_SUFFIX'
  | 'PYTHON_MODULE_PATH';

export type TargetResolution =
  | { kind: 'RESOLVED'; filePath: string; strategy: ResolutionStrategy }
  | { kind: 'EXTERNAL'; targetName: string }
  | { kind: 'UNRESOLVED'; reason: UnresolvedReason };

/** A module node in the derived graph (spec AD-2, FR-3). */
export interface ArchitectureModuleNode {
  key: string;
  name: string;
  path: string;
  fileCount: number;
  symbolCount: number;
  languages: string[];
  outgoingDependencyCount: number;
  incomingDependencyCount: number;
  internalRelationCount: number;
  unresolvedRelationCount: number;
  externalRelationCount: number;
  significance: number;
}

/** One piece of source evidence behind a module dependency (spec EV-2). */
export interface DependencyEvidenceItem {
  sourceFilePath: string;
  targetFilePath: string;
  relationType: SymbolRelationType;
  observedTarget: string | null;
  targetName: string | null;
  strategy: ResolutionStrategy;
}

/** A directed module-to-module dependency (spec AD-2, FR-4). */
export interface ModuleDependencyEdge {
  fromModuleKey: string;
  toModuleKey: string;
  relationTypes: SymbolRelationType[];
  supportingRelationCount: number;
  confidence: Extract<DependencyConfidence, 'RESOLVED'>;
  evidence: DependencyEvidenceItem[];
  evidenceTruncated: boolean;
}

/** A relationship observed in source whose target has no module (spec FR-6). */
export interface UnresolvedRelationshipRecord {
  moduleKey: string;
  sourceFilePath: string;
  observedTarget: string | null;
  targetName: string | null;
  relationType: SymbolRelationType;
  reason: UnresolvedReason;
  occurrenceCount: number;
}

/** A relationship whose target is outside the repository (spec FR-7). */
export interface ExternalDependencyRecord {
  moduleKey: string;
  targetName: string;
  relationType: SymbolRelationType;
  occurrenceCount: number;
}

/** Why a set of indexed files did not take part in grouping (spec FR-2). */
export interface ModuleExclusionSummary {
  reason: string;
  fileCount: number;
}

/**
 * Repository-level counts for relationship types that cannot produce a module
 * dependency, reported so the types are not silently dropped (spec RS-2).
 */
export interface NonDependencyRelationCount {
  relationType: SymbolRelationType;
  count: number;
}

export interface DependencyGraphTotals {
  moduleCount: number;
  dependencyCount: number;
  resolvedRelationCount: number;
  unresolvedRelationCount: number;
  externalRelationCount: number;
  internalRelationCount: number;
  groupedFileCount: number;
  excludedFileCount: number;
}

/**
 * The full derived graph for exactly one indexing revision (spec FR-11).
 * This is what gets cached; every view is assembled from it.
 */
export interface DependencyGraph {
  repositoryId: string;
  indexingRunId: string;
  modules: ArchitectureModuleNode[];
  /**
   * Grouped file paths per module key. Retained so module detail is served
   * from the same revision as the rest of the view without a second grouping
   * pass, which a path prefix query could not reproduce exactly.
   */
  filePathsByModule: Record<string, string[]>;
  dependencies: ModuleDependencyEdge[];
  unresolved: UnresolvedRelationshipRecord[];
  external: ExternalDependencyRecord[];
  exclusions: ModuleExclusionSummary[];
  nonDependencyRelationCounts: NonDependencyRelationCount[];
  totals: DependencyGraphTotals;
  /** True when the input was truncated by the derivation ceiling (spec ST-7). */
  partial: boolean;
  partialReasons: string[];
}
