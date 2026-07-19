import { CodeSymbolType } from '@prisma/client';
import { SymbolExtractorService } from './symbol-extractor.service';

describe('SymbolExtractorService', () => {
  const service = new SymbolExtractorService();

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
  });
});
