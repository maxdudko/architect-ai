import { Injectable } from '@nestjs/common';
import { SymbolRelationshipExtractor } from '../interfaces/symbol-relationship-extractor.interface';
import { LanguagePackRegistry } from '../languages/language-pack.registry';
import { ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';

@Injectable()
export class SymbolRelationshipExtractorService implements SymbolRelationshipExtractor {
  constructor(private readonly languagePacks: LanguagePackRegistry) {}

  extract(params: {
    filePath: string;
    ast: ParsedFileAst;
    symbols: ExtractedSymbol[];
  }): ExtractedSymbolRelationship[] {
    const pack = this.languagePacks.getByLanguage(params.ast.language);
    if (!pack) {
      return [];
    }
    return pack.extractRelations(params);
  }
}
