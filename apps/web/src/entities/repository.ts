export type RepositoryProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';
export type RepositoryStatus =
  | 'PENDING'
  | 'CLONING'
  | 'PARSING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'READY'
  | 'FAILED';

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
