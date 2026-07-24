export interface RetrievedChunkReference {
  chunkId: string;
  repositoryId: string;
  filePath: string;
  symbolName: string | null;
  qualifiedName: string | null;
  startLine: number | null;
  endLine: number | null;
  score: number;
}

export interface RetrievedChunk {
  id: string;
  repositoryId: string;
  fileId: string | null;
  symbolId: string | null;
  filePath: string;
  content: string;
  tokenCount: number;
  startLine: number | null;
  endLine: number | null;
  language: string | null;
  symbolName: string | null;
  qualifiedName: string | null;
  symbolType: string | null;
  score: number;
}

export interface RetrievedSymbol {
  id: string;
  name: string | null;
  qualifiedName: string | null;
  type: string | null;
  filePath: string;
  repositoryId: string;
}

export interface RetrievedFile {
  id: string | null;
  path: string;
  repositoryId: string;
  language: string | null;
}

export interface RetrievedContext {
  chunks: RetrievedChunk[];
  symbols: RetrievedSymbol[];
  files: RetrievedFile[];
  references: RetrievedChunkReference[];
}
