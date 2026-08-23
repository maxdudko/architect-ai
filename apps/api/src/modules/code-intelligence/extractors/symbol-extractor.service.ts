import { Injectable } from '@nestjs/common';
import { SymbolExtractor } from '../interfaces/symbol-extractor.interface';
import { LanguagePackRegistry } from '../languages/language-pack.registry';
import { ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { createModuleSymbol } from '../languages/ast-helpers';

@Injectable()
export class SymbolExtractorService implements SymbolExtractor {
  constructor(private readonly languagePacks: LanguagePackRegistry) {}

  extract(filePath: string, ast: ParsedFileAst): ExtractedSymbol[] {
    const pack = this.languagePacks.getByLanguage(ast.language);
    if (!pack) {
      return [createModuleSymbol(filePath, ast.language, ast.tree.root)];
    }
    return pack.extractSymbols(filePath, ast);
  }
}
