import { Injectable } from '@nestjs/common';
import type ParserType from 'tree-sitter';
import { TreeSitterAstAdapter } from '../ast/tree-sitter-ast.adapter';
import { UnparseableFileError } from '../errors/unparseable-file.error';
import { LanguageParser } from '../interfaces/language-parser.interface';
import { LanguagePackRegistry } from '../languages/language-pack.registry';
import { loadNativeGrammar } from '../languages/load-native-grammar';
import { ParsedFileAst } from '../types/ast.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';

const Parser = loadNativeGrammar('tree-sitter') as typeof ParserType;

@Injectable()
export class TreeSitterLanguageParserService implements LanguageParser {
  private readonly astAdapter = new TreeSitterAstAdapter();

  constructor(private readonly languagePacks: LanguagePackRegistry) {}

  supports(language: string): boolean {
    return this.languagePacks.canParse(language);
  }

  parse(file: RepositoryFileCandidate, source: string): ParsedFileAst {
    if (!this.supports(file.language)) {
      throw new Error(`Unsupported language parser: ${file.language}`);
    }

    const pack = this.languagePacks.getByLanguage(file.language);
    if (!pack) {
      throw new Error(`Missing language pack for ${file.language}`);
    }

    const grammar = pack.resolveGrammar(file);
    if (!grammar) {
      throw new Error(`Missing grammar for ${file.language}`);
    }

    try {
      // Create a fresh parser per call. Caching Parser instances across Jest
      // files has been unreliable with the tree-sitter native addon.
      const parser = new Parser();
      parser.setLanguage(grammar);
      const tree = parser.parse(source);

      if (!tree?.rootNode) {
        throw new Error(
          `Tree-sitter returned no root node for ${file.relativePath}`,
        );
      }

      return {
        language: file.language,
        source,
        tree: this.astAdapter.toAstTree(tree),
      };
    } catch (error) {
      if (error instanceof UnparseableFileError) {
        throw error;
      }
      throw new UnparseableFileError(file.relativePath, error);
    }
  }
}
