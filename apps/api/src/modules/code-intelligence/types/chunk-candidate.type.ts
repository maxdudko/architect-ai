import { Prisma } from '@prisma/client';
import { ProgrammingLanguage } from './programming-language.type';

export interface SemanticChunkCandidate {
  symbolId: string;
  fileId: string;
  filePath: string;
  language: ProgrammingLanguage;
  startLine: number;
  endLine: number;
  content: string;
  tokenCount: number;
  metadata: Prisma.JsonObject;
}
