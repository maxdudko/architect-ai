export interface ChunkVectorPayload {
  workspaceId: string;
  repositoryId: string;
  chunkId: string;
  symbolId: string | null;
  fileId: string | null;
  filePath: string;
  symbolName: string | null;
  qualifiedName: string | null;
  symbolType: string | null;
  language: string | null;
  branch: string;
  createdAt: string;
}
