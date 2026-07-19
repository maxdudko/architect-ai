jest.mock(
  'tree-sitter',
  () => {
    return class MockParser {
      private language: unknown;

      setLanguage(language: unknown): void {
        this.language = language;
      }

      parse(source: string): {
        rootNode: {
          type: string;
          text: string;
          startPosition: { row: number; column: number };
          endPosition: { row: number; column: number };
          namedChildren: never[];
        };
      } {
        if (!this.language) {
          throw new Error('Language not configured');
        }
        return {
          rootNode: {
            type: 'program',
            text: source,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: source.length },
            namedChildren: [],
          },
        };
      }
    };
  },
  { virtual: true },
);

jest.mock('tree-sitter-javascript', () => ({}), { virtual: true });

jest.mock(
  'tree-sitter-typescript',
  () => ({
    typescript: {},
  }),
  { virtual: true },
);

import { TreeSitterLanguageParserService } from './tree-sitter-language-parser.service';

describe('TreeSitterLanguageParserService', () => {
  const service = new TreeSitterLanguageParserService();

  it('parses TypeScript source into AST abstraction', () => {
    const ast = service.parse(
      {
        absolutePath: '/repo/src/auth.service.ts',
        relativePath: 'src/auth.service.ts',
        language: 'typescript',
        extension: '.ts',
        size: 10,
        checksum: 'abc',
      },
      'export class AuthService { login() { return true; } }',
    );

    expect(ast.tree.root.type.length).toBeGreaterThan(0);
    expect(ast.language).toBe('typescript');
  });
});
