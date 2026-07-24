export interface SemanticChunkRecord {
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
  createdAt: Date;
}
