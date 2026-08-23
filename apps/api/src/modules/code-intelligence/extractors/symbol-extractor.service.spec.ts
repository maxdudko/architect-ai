import { CodeSymbolType } from '@prisma/client';
import { createDefaultLanguagePackRegistry } from '../languages/default-language-packs';
import { SymbolExtractorService } from './symbol-extractor.service';

describe('SymbolExtractorService', () => {
  const service = new SymbolExtractorService(
    createDefaultLanguagePackRegistry(),
  );

  it('extracts class and method symbols', () => {
    const symbols = service.extract('src/auth.service.ts', {
      language: 'typescript',
      source: 'export class AuthService { async login() {} }',
      tree: {
        root: {
          type: 'program',
          text: '',
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 46 },
          },
          children: [
            {
              type: 'class_declaration',
              text: 'export class AuthService { async login() {} }',
              range: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 46 },
              },
              children: [
                {
                  type: 'method_definition',
                  text: 'async login() {}',
                  range: {
                    start: { line: 1, column: 28 },
                    end: { line: 1, column: 44 },
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      },
    });

    expect(
      symbols.some((symbol) => symbol.type === CodeSymbolType.MODULE),
    ).toBe(true);
    expect(symbols.some((symbol) => symbol.type === CodeSymbolType.CLASS)).toBe(
      true,
    );
    expect(
      symbols.some((symbol) => symbol.type === CodeSymbolType.METHOD),
    ).toBe(true);
    expect(
      symbols.every((symbol) => symbol.filePath === 'src/auth.service.ts'),
    ).toBe(true);
    expect(symbols.every((symbol) => symbol.language === 'typescript')).toBe(
      true,
    );
  });

  it('classifies arrow and function assignments as FUNCTION', () => {
    const symbols = service.extract('src/handlers.ts', {
      language: 'typescript',
      source: 'const login = async () => {}; const x = 1;',
      tree: {
        root: {
          type: 'program',
          text: '',
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 42 },
          },
          children: [
            {
              type: 'lexical_declaration',
              text: 'const login = async () => {}',
              range: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 28 },
              },
              children: [
                {
                  type: 'variable_declarator',
                  text: 'login = async () => {}',
                  range: {
                    start: { line: 1, column: 7 },
                    end: { line: 1, column: 28 },
                  },
                  children: [
                    {
                      type: 'identifier',
                      text: 'login',
                      range: {
                        start: { line: 1, column: 7 },
                        end: { line: 1, column: 12 },
                      },
                      children: [],
                    },
                    {
                      type: 'arrow_function',
                      text: 'async () => {}',
                      range: {
                        start: { line: 1, column: 15 },
                        end: { line: 1, column: 28 },
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              type: 'lexical_declaration',
              text: 'const x = 1',
              range: {
                start: { line: 1, column: 30 },
                end: { line: 1, column: 41 },
              },
              children: [
                {
                  type: 'variable_declarator',
                  text: 'x = 1',
                  range: {
                    start: { line: 1, column: 36 },
                    end: { line: 1, column: 41 },
                  },
                  children: [
                    {
                      type: 'identifier',
                      text: 'x',
                      range: {
                        start: { line: 1, column: 36 },
                        end: { line: 1, column: 37 },
                      },
                      children: [],
                    },
                    {
                      type: 'number',
                      text: '1',
                      range: {
                        start: { line: 1, column: 40 },
                        end: { line: 1, column: 41 },
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'login' && symbol.type === CodeSymbolType.FUNCTION,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'x' && symbol.type === CodeSymbolType.CONSTANT,
      ),
    ).toBe(true);
  });
});
