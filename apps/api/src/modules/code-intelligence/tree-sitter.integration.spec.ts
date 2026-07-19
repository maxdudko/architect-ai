import { CodeSymbolType } from '@prisma/client';
import { TreeSitterLanguageParserService } from './parser/tree-sitter-language-parser.service';
import { SymbolExtractorService } from './extractors/symbol-extractor.service';

/**
 * All real Tree-sitter coverage lives in this single file so native addon
 * usage stays within one Jest module graph (avoids cross-file flakiness).
 */
describe('Tree-sitter code intelligence (integration)', () => {
  const parser = new TreeSitterLanguageParserService();
  const extractor = new SymbolExtractorService();

  it('parses TypeScript source into AST abstraction', () => {
    const ast = parser.parse(
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

    expect(ast.tree.root.type).toBe('program');
    expect(ast.language).toBe('typescript');
    expect(JSON.stringify(ast.tree)).toContain('class_declaration');
  });

  it('parses TSX source using the TSX grammar', () => {
    const source =
      'export function App() { return <div className="hello">Hi</div>; }';
    const ast = parser.parse(
      {
        absolutePath: '/repo/src/app.tsx',
        relativePath: 'src/app.tsx',
        language: 'typescript',
        extension: '.tsx',
        size: source.length,
        checksum: 'def',
      },
      source,
    );

    expect(ast.tree.root.type).toBe('program');
    expect(ast.language).toBe('typescript');
    expect(JSON.stringify(ast.tree)).toContain('jsx_element');
  });

  it('extracts symbols from real TypeScript source', () => {
    const source = `
export interface AuthUser { id: string }
export class AuthService {
  async login() { return true; }
}
export function register() {}
export const verify = async () => {};
export const MAX_RETRIES = 3;
`;

    const filePath = 'src/auth.ts';
    const ast = parser.parse(
      {
        absolutePath: `/repo/${filePath}`,
        relativePath: filePath,
        language: 'typescript',
        extension: '.ts',
        size: source.length,
        checksum: 'auth',
      },
      source,
    );

    const symbols = extractor.extract(filePath, ast);

    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'AuthUser' &&
          symbol.type === CodeSymbolType.INTERFACE,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'AuthService' && symbol.type === CodeSymbolType.CLASS,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'login' && symbol.type === CodeSymbolType.METHOD,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'register' && symbol.type === CodeSymbolType.FUNCTION,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'verify' && symbol.type === CodeSymbolType.FUNCTION,
      ),
    ).toBe(true);
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'MAX_RETRIES' &&
          symbol.type === CodeSymbolType.CONSTANT,
      ),
    ).toBe(true);
    expect(symbols.every((symbol) => symbol.filePath === filePath)).toBe(true);
  });
});
