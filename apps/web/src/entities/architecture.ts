import type { RepositoryStatus } from './repository';

export type SymbolRelationType =
  | 'IMPORTS'
  | 'EXPORTS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'CALLS'
  | 'USES';

/**
 * Confidence classification carried by every displayed relationship. It is
 * never upgraded by name or semantic similarity.
 */
export type DependencyConfidence = 'RESOLVED' | 'UNRESOLVED' | 'EXTERNAL';

export type UnresolvedReason =
  | 'NO_TARGET_PATH_RECORDED'
  | 'RELATIVE_PATH_NOT_FOUND'
  | 'ALIAS_UNRESOLVED'
  | 'AMBIGUOUS_MATCH'
  | 'TARGET_MODULE_EXCLUDED';

export type ResolutionStrategy = 'RELATIVE_PATH' | 'PATH_SUFFIX' | 'PYTHON_MODULE_PATH';

export type DependencyMapState =
  | 'READY'
  | 'NO_INDEX'
  | 'REBUILDING'
  | 'NO_MODULES'
  | 'NO_DEPENDENCIES'
  | 'PARTIAL';

export interface ArchitectureRevision {
  indexingRunId: string;
  branch: string | null;
  commitSha: string | null;
  completedAt: string | null;
}

export interface BoundDisclosure {
  limit: number;
  returned: number;
  total: number;
  truncated: boolean;
}

export interface ArchitectureModuleSummary {
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

export interface ModuleExclusion {
  reason: string;
  fileCount: number;
}

export interface NonDependencyRelationCount {
  relationType: SymbolRelationType;
  count: number;
}

export interface DependencyMapTotals {
  moduleCount: number;
  dependencyCount: number;
  resolvedRelationCount: number;
  unresolvedRelationCount: number;
  externalRelationCount: number;
  internalRelationCount: number;
  groupedFileCount: number;
  excludedFileCount: number;
}

export interface DependencyMapEdge {
  fromModuleKey: string;
  toModuleKey: string;
  relationTypes: SymbolRelationType[];
  supportingRelationCount: number;
  confidence: Extract<DependencyConfidence, 'RESOLVED'>;
}

export interface DependencyMap {
  repositoryId: string;
  repositoryStatus: RepositoryStatus;
  state: DependencyMapState;
  revision: ArchitectureRevision | null;
  rebuildInProgress: boolean;
  modules: ArchitectureModuleSummary[];
  moduleBounds: BoundDisclosure;
  dependencies: DependencyMapEdge[];
  dependencyBounds: BoundDisclosure;
  focusedExplorationRequired: boolean;
  totals: DependencyMapTotals;
  exclusions: ModuleExclusion[];
  nonDependencyRelationCounts: NonDependencyRelationCount[];
  groupingRules: string[];
  limitations: string[];
  partial: boolean;
  partialReasons: string[];
}

export interface ModuleDependency {
  fromModuleKey: string;
  toModuleKey: string;
  relatedModuleKey: string;
  relatedModuleName: string;
  relationTypes: SymbolRelationType[];
  supportingRelationCount: number;
  confidence: DependencyConfidence;
  evidenceAvailable: number;
  evidenceTruncated: boolean;
}

export interface UnresolvedRelationship {
  moduleKey: string;
  sourceFilePath: string;
  observedTarget: string | null;
  targetName: string | null;
  relationType: SymbolRelationType;
  reason: UnresolvedReason;
  reasonDescription: string;
  occurrenceCount: number;
  confidence: DependencyConfidence;
}

export interface ExternalDependency {
  moduleKey: string;
  targetName: string;
  relationType: SymbolRelationType;
  occurrenceCount: number;
  confidence: DependencyConfidence;
}

export interface ArchitectureModuleFile {
  path: string;
  language: string;
  lineCount: number;
}

export interface ArchitectureModuleSymbol {
  name: string;
  qualifiedName: string;
  type: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
}

export interface ArchitectureModuleDetail {
  repositoryId: string;
  revision: ArchitectureRevision;
  module: ArchitectureModuleSummary;
  dependencies: ModuleDependency[];
  dependencyBounds: BoundDisclosure;
  dependents: ModuleDependency[];
  dependentBounds: BoundDisclosure;
  unresolved: UnresolvedRelationship[];
  unresolvedBounds: BoundDisclosure;
  external: ExternalDependency[];
  externalBounds: BoundDisclosure;
  files: ArchitectureModuleFile[];
  fileBounds: BoundDisclosure;
  notableSymbols: ArchitectureModuleSymbol[];
  limitations: string[];
}

export interface ArchitectureSourceReference {
  repositoryId: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  name: string | null;
  qualifiedName: string | null;
  relationType: SymbolRelationType;
}

export interface DependencyEvidenceItem {
  source: ArchitectureSourceReference;
  target: ArchitectureSourceReference;
  observedTarget: string | null;
  targetName: string | null;
  resolutionStrategy: ResolutionStrategy;
}

export interface DependencyEvidence {
  repositoryId: string;
  revision: ArchitectureRevision;
  fromModuleKey: string;
  toModuleKey: string;
  relationTypes: SymbolRelationType[];
  supportingRelationCount: number;
  confidence: DependencyConfidence;
  items: DependencyEvidenceItem[];
  bounds: BoundDisclosure;
  limitations: string[];
}
