import { Injectable } from '@nestjs/common';
import Parser from 'tree-sitter';
import * as JavaScript from 'tree-sitter-javascript';
import * as TypeScript from 'tree-sitter-typescript';
import { TreeSitterAstAdapter } from '../ast/tree-sitter-ast.adapter';
import { LanguageParser } from '../interfaces/language-parser.interface';
import { ParsedFileAst } from '../types/ast.type';
import {
  PROGRAMMING_LANGUAGES,
  ProgrammingLanguage,
} from '../types/programming-language.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';

@Injectable()
export class TreeSitterLanguageParserService implements LanguageParser {
  private readonly astAdapter = new TreeSitterAstAdapter();

  private readonly parsers = new Map<ProgrammingLanguage, Parser>();

  private readonly languages = new Map<ProgrammingLanguage, unknown>([
    [PROGRAMMING_LANGUAGES.typescript, TypeScript.typescript],
    [PROGRAMMING_LANGUAGES.javascript, JavaScript],
  ]);

  supports(language: string): boolean {
    return this.languages.has(language as ProgrammingLanguage);
  }

  parse(file: RepositoryFileCandidate, source: string): ParsedFileAst {
    if (!this.supports(file.language)) {
      throw new Error(`Unsupported language parser: ${file.language}`);
    }

    const parser = this.getOrCreateParser(file.language);
    const tree = parser.parse(source);

    return {
      language: file.language,
      source,
      tree: this.astAdapter.toAstTree(tree),
    };
  }

  private getOrCreateParser(language: ProgrammingLanguage): Parser {
    const existingParser = this.parsers.get(language);
    if (existingParser) {
      return existingParser;
    }

    const grammar = this.languages.get(language);
    if (!grammar) {
      throw new Error(`Missing grammar for ${language}`);
    }

    const parser = new Parser();
    parser.setLanguage(grammar);
    this.parsers.set(language, parser);

    return parser;
  }
}
