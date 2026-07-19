import { ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';

export interface SymbolRelationshipExtractor {
  extract(params: {
    filePath: string;
    ast: ParsedFileAst;
    symbols: ExtractedSymbol[];
  }): ExtractedSymbolRelationship[];
}
