import { ChunkVectorPayload } from './chunk-vector-payload.type';

export interface ChunkForIndexing {
  id: string;
  content: string;
  workspaceId: string;
  repositoryId: string;
  indexingRunId: string;
  fileId: string | null;
  symbolId: string | null;
  filePath: string;
  symbolName: string | null;
  qualifiedName: string | null;
  symbolType: string | null;
  language: string | null;
  branch: string;
  createdAt: Date;
}

export function toChunkVectorPayload(
  chunk: ChunkForIndexing,
): ChunkVectorPayload {
  return {
    workspaceId: chunk.workspaceId,
    repositoryId: chunk.repositoryId,
    indexingRunId: chunk.indexingRunId,
    chunkId: chunk.id,
    symbolId: chunk.symbolId,
    fileId: chunk.fileId,
    filePath: chunk.filePath,
    symbolName: chunk.symbolName,
    qualifiedName: chunk.qualifiedName,
    symbolType: chunk.symbolType,
    language: chunk.language,
    branch: chunk.branch,
    createdAt: chunk.createdAt.toISOString(),
  };
}
