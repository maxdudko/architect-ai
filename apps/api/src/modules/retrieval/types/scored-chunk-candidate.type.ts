export interface ScoredChunkCandidate {
  chunkId: string;
  score: number;
  workspaceId: string;
  repositoryId: string;
  fileId: string | null;
  symbolId: string | null;
  filePath: string;
  symbolName: string | null;
  qualifiedName: string | null;
  symbolType: string | null;
  language: string | null;
  branch: string;
  createdAt: string | null;
}
