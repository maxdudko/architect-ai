import { CodeSymbolType, SymbolRelationType } from '@prisma/client';
import { phpLanguagePack } from './php.pack';
import type { ParsedFileAst } from '../types/ast.type';

function range(line: number) {
  return {
    start: { line, column: 1 },
    end: { line, column: 40 },
  };
}

describe('phpLanguagePack', () => {
  it('extracts classes, methods, and use imports from a field-aware AST', () => {
    const ast: ParsedFileAst = {
      language: 'php',
      source: '',
      tree: {
        root: {
          type: 'program',
          text: '',
          range: range(1),
          children: [
            {
              type: 'namespace_use_declaration',
              text: 'use App\\Models\\User;',
              range: range(2),
              children: [
                {
                  type: 'qualified_name',
                  text: 'App\\Models\\User',
                  range: range(2),
                  children: [],
                },
              ],
            },
            {
              type: 'class_declaration',
              text: 'class UserController { public function index() {} }',
              range: {
                start: { line: 3, column: 1 },
                end: { line: 6, column: 1 },
              },
              children: [
                {
                  type: 'name',
                  text: 'UserController',
                  fieldName: 'name',
                  range: range(3),
                  children: [],
                },
                {
                  type: 'declaration_list',
                  text: 'public function index() {}',
                  fieldName: 'body',
                  range: {
                    start: { line: 4, column: 1 },
                    end: { line: 6, column: 1 },
                  },
                  children: [
                    {
                      type: 'method_declaration',
                      text: 'public function index() {}',
                      range: range(5),
                      children: [
                        {
                          type: 'name',
                          text: 'index',
                          fieldName: 'name',
                          range: range(5),
                          children: [],
                        },
                      ],
                    },
                    {
                      type: 'method_declaration',
                      text: 'private function hidden() {}',
                      range: range(6),
                      children: [
                        {
                          type: 'name',
                          text: 'hidden',
                          fieldName: 'name',
                          range: range(6),
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };

    const symbols = phpLanguagePack.extractSymbols(
      'app/Http/Controllers/UserController.php',
      ast,
    );
    const relations = phpLanguagePack.extractRelations({
      filePath: 'app/Http/Controllers/UserController.php',
      ast,
      symbols,
    });

    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'UserController' &&
          symbol.type === CodeSymbolType.CLASS,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'index' &&
          symbol.type === CodeSymbolType.METHOD &&
          symbol.exported,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'hidden' &&
          symbol.type === CodeSymbolType.METHOD &&
          symbol.exported === false,
      ),
    ).toBe(true);
    expect(
      relations.some(
        (relation) =>
          relation.relationType === SymbolRelationType.IMPORTS &&
          relation.toSymbolQualifiedName.includes('User'),
      ),
    ).toBe(true);
  });
});
