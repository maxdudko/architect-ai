import { CodeSymbolType } from '@prisma/client';
import { ProgrammingLanguage } from './programming-language.type';

export interface ExtractedSymbol {
  localId: string;
  name: string;
  qualifiedName: string;
  type: CodeSymbolType;
  language: ProgrammingLanguage;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  exported: boolean;
  isAsync: boolean;
  isStatic: boolean;
  visibility: string;
  parentLocalId: string | null;
}
