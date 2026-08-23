import { CodeSymbolType, SymbolRelationType } from '@prisma/client';
import { pythonLanguagePack } from './python.pack';
import type { ParsedFileAst } from '../types/ast.type';

function range(line: number) {
  return {
    start: { line, column: 1 },
    end: { line, column: 20 },
  };
}

describe('pythonLanguagePack', () => {
  it('extracts class methods, public names, and imports from a field-aware AST', () => {
    const ast: ParsedFileAst = {
      language: 'python',
      source: '',
      tree: {
        root: {
          type: 'module',
          text: '',
          range: range(1),
          children: [
            {
              type: 'import_from_statement',
              text: 'from django.db import models',
              range: range(1),
              children: [
                {
                  type: 'dotted_name',
                  text: 'django.db',
                  fieldName: 'module_name',
                  range: range(1),
                  children: [],
                },
                {
                  type: 'dotted_name',
                  text: 'models',
                  fieldName: 'name',
                  range: range(1),
                  children: [],
                },
              ],
            },
            {
              type: 'class_definition',
              text: 'class UserViewSet:\n    def list(self): pass',
              range: {
                start: { line: 2, column: 1 },
                end: { line: 4, column: 1 },
              },
              children: [
                {
                  type: 'identifier',
                  text: 'UserViewSet',
                  fieldName: 'name',
                  range: range(2),
                  children: [],
                },
                {
                  type: 'block',
                  text: 'def list(self): pass',
                  fieldName: 'body',
                  range: {
                    start: { line: 3, column: 5 },
                    end: { line: 4, column: 1 },
                  },
                  children: [
                    {
                      type: 'function_definition',
                      text: 'def list(self): pass',
                      range: range(3),
                      children: [
                        {
                          type: 'identifier',
                          text: 'list',
                          fieldName: 'name',
                          range: range(3),
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'function_definition',
              text: 'def _private(): pass',
              range: range(6),
              children: [
                {
                  type: 'identifier',
                  text: '_private',
                  fieldName: 'name',
                  range: range(6),
                  children: [],
                },
              ],
            },
          ],
        },
      },
    };

    const symbols = pythonLanguagePack.extractSymbols('app/views.py', ast);
    const relations = pythonLanguagePack.extractRelations({
      filePath: 'app/views.py',
      ast,
      symbols,
    });

    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'UserViewSet' &&
          symbol.type === CodeSymbolType.CLASS &&
          symbol.exported,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'list' && symbol.type === CodeSymbolType.METHOD,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) => symbol.name === '_private' && symbol.exported === false,
      ),
    ).toBe(true);
    expect(
      relations.some(
        (relation) =>
          relation.relationType === SymbolRelationType.IMPORTS &&
          relation.toSymbolQualifiedName === 'models',
      ),
    ).toBe(true);
  });
});
