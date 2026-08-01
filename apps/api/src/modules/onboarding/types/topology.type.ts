export interface TopologyRepositoryMetadata {
  id: string;
  workspaceId: string;
  name: string;
  fullName: string;
  provider: string;
  defaultBranch: string;
  status: string;
  lastIndexedAt: Date | null;
}

export interface TopologyCounts {
  files: number;
  sourceLines: number;
  symbols: number;
  relations: number;
  exportedSymbols: number;
  asyncSymbols: number;
  averageSymbolsPerFile: number;
  relationDensity: number;
}

export interface TopologyFolder {
  path: string;
  fileCount: number;
  lineCount: number;
  symbolCount: number;
  relationCount: number;
  score: number;
}

export interface TopologyCandidate {
  key: string;
  name: string;
  path: string;
  evidencePaths: string[];
  score: number;
  reasons: string[];
}

export interface TopologyEntryPointHint {
  path: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface TopologyTechnologyEvidence {
  name: string;
  category: 'language' | 'framework' | 'tooling' | 'data' | 'runtime';
  confidence: 'high' | 'medium' | 'low';
  evidencePaths: string[];
  evidence: string;
}

export interface RepositoryTopology {
  repository: TopologyRepositoryMetadata;
  counts: TopologyCounts;
  complexity: 'small' | 'moderate' | 'large' | 'very-large';
  majorFolders: TopologyFolder[];
  moduleCandidates: TopologyCandidate[];
  serviceCandidates: TopologyCandidate[];
  entryPointHints: TopologyEntryPointHint[];
  technologyEvidence: TopologyTechnologyEvidence[];
  source: {
    indexingRunId: string;
    commitSha: string | null;
    branch: string | null;
    completedAt: Date | null;
  };
}

export interface IndexedTopologySnapshot {
  repository: TopologyRepositoryMetadata;
  run: RepositoryTopology['source'];
  files: Array<{
    path: string;
    language: string;
    extension: string;
    lineCount: number;
    size: number;
  }>;
  symbols: Array<{
    filePath: string;
    name: string;
    qualifiedName: string;
    type: string;
    exported: boolean;
    isAsync: boolean;
  }>;
  relations: Array<{
    fromFilePath: string;
    type: string;
    targetFilePath: string | null;
    targetQualifiedName: string | null;
  }>;
}
