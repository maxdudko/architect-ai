export type RepositoryProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';
export type RepositoryStatus =
  | 'PENDING'
  | 'CLONING'
  | 'PARSING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'READY'
  | 'FAILED';

export type CodeSymbolType =
  | 'FUNCTION'
  | 'CLASS'
  | 'METHOD'
  | 'INTERFACE'
  | 'ENUM'
  | 'TYPE_ALIAS'
  | 'VARIABLE'
  | 'CONSTANT'
  | 'NAMESPACE'
  | 'MODULE';

export interface Repository {
  id: string;
  workspaceId: string;
  provider: RepositoryProvider;
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  status: RepositoryStatus;
  lastIndexedAt: string | null;
  indexingError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryFile {
  id: string;
  repositoryId: string;
  path: string;
  language: string;
  size: number;
  lineCount: number;
  extension: string;
  generated: boolean;
  ignored: boolean;
  binary: boolean;
  createdAt: string;
}

export interface CodeSymbol {
  id: string;
  repositoryId: string;
  name: string;
  qualifiedName: string;
  type: CodeSymbolType;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  fileId?: string | null;
  createdAt: string;
}
