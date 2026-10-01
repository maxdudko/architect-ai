import type { CodeSymbolType, SymbolRelationType } from '@prisma/client';

export interface ArchitectureSnapshotFile {
  path: string;
  language: string;
  lineCount: number;
}

/**
 * A distinct import relationship row for one revision. `observedTarget` is the
 * raw `SymbolRelation.targetFilePath` written by the language pack: a module
 * specifier for JavaScript and TypeScript, a dotted module name for Python
 * `from` imports, and null for PHP `use` and plain Python `import` statements.
 */
export interface ArchitectureSnapshotImport {
  sourceFilePath: string;
  observedTarget: string | null;
  targetName: string | null;
  relationType: SymbolRelationType;
}

export interface ArchitectureSnapshotSymbolCount {
  filePath: string;
  count: number;
}

export interface ArchitectureSnapshotNotableSymbol {
  name: string;
  qualifiedName: string;
  type: CodeSymbolType;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
}

export interface ArchitectureSnapshotRelationCount {
  relationType: SymbolRelationType;
  count: number;
}

/**
 * Everything the derivation needs from one indexing revision. Loaded by three
 * bounded queries; nothing here is proportional to module count multiplied by
 * relationship count (spec AD-6).
 */
export interface ArchitectureSnapshot {
  repositoryId: string;
  indexingRunId: string;
  files: ArchitectureSnapshotFile[];
  symbolCountsByFile: ArchitectureSnapshotSymbolCount[];
  imports: ArchitectureSnapshotImport[];
  nonImportRelationCounts: ArchitectureSnapshotRelationCount[];
  filesTruncated: boolean;
  importsTruncated: boolean;
}

export interface ArchitectureRevision {
  indexingRunId: string;
  branch: string | null;
  commitSha: string | null;
  completedAt: Date | null;
}
