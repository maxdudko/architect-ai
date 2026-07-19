import { ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';

export interface SymbolExtractor {
  extract(filePath: string, ast: ParsedFileAst): ExtractedSymbol[];
}
