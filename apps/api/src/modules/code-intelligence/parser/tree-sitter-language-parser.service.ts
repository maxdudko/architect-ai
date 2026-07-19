import { Injectable } from '@nestjs/common';
import { createRequire } from 'node:module';
import type ParserType from 'tree-sitter';
import { TreeSitterAstAdapter } from '../ast/tree-sitter-ast.adapter';
import { LanguageParser } from '../interfaces/language-parser.interface';
import { ParsedFileAst } from '../types/ast.type';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';

type GrammarKey = 'typescript' | 'tsx' | 'javascript';

const nodeRequire = createRequire(__filename);

// Native addons are loaded via createRequire so Jest/CJS interop stays stable.
const Parser = nodeRequire('tree-sitter') as typeof ParserType;
const TypeScript = nodeRequire('tree-sitter-typescript') as {
  typescript: unknown;
  tsx: unknown;
};
const JavaScript = nodeRequire('tree-sitter-javascript') as unknown;

@Injectable()
export class TreeSitterLanguageParserService implements LanguageParser {
  private readonly astAdapter = new TreeSitterAstAdapter();

  private readonly grammars = new Map<GrammarKey, unknown>([
    ['typescript', TypeScript.typescript],
    ['tsx', TypeScript.tsx],
    ['javascript', JavaScript],
  ]);

  supports(language: string): boolean {
    return (
      language === PROGRAMMING_LANGUAGES.typescript ||
      language === PROGRAMMING_LANGUAGES.javascript
    );
  }

  parse(file: RepositoryFileCandidate, source: string): ParsedFileAst {
    if (!this.supports(file.language)) {
      throw new Error(`Unsupported language parser: ${file.language}`);
    }

    const grammarKey = this.resolveGrammarKey(file);
    const grammar = this.grammars.get(grammarKey);
    if (!grammar) {
      throw new Error(`Missing grammar for ${grammarKey}`);
    }

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
  }

  private resolveGrammarKey(file: RepositoryFileCandidate): GrammarKey {
    if (file.extension.toLowerCase() === '.tsx') {
      return 'tsx';
    }

    if (file.language === PROGRAMMING_LANGUAGES.javascript) {
      return 'javascript';
    }

    return 'typescript';
  }
}
