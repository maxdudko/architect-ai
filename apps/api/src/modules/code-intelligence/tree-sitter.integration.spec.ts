import { CodeSymbolType } from '@prisma/client';
import { createDefaultLanguagePackRegistry } from './languages/default-language-packs';
import { TreeSitterLanguageParserService } from './parser/tree-sitter-language-parser.service';
import { SymbolExtractorService } from './extractors/symbol-extractor.service';

/**
 * All real Tree-sitter coverage lives in this single file so native addon
 * usage stays within one Jest module graph (avoids cross-file flakiness).
 */
describe('Tree-sitter code intelligence (integration)', () => {
  const registry = createDefaultLanguagePackRegistry();
  const parser = new TreeSitterLanguageParserService(registry);
  const extractor = new SymbolExtractorService(registry);

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

  it('extracts Python class, method, function, and import relations', () => {
    const source = `
from django.db import models

class UserViewSet:
    def list(self):
        return []

async def handle_task():
    return True

MAX_RETRIES = 3
`;
    const filePath = 'app/views.py';
    const ast = parser.parse(
      {
        absolutePath: `/repo/${filePath}`,
        relativePath: filePath,
        language: 'python',
        extension: '.py',
        size: source.length,
        checksum: 'py',
      },
      source,
    );

    const symbols = extractor.extract(filePath, ast);
    const relations = registry
      .getByLanguage('python')!
      .extractRelations({ filePath, ast, symbols });

    expect(ast.tree.root.type).toBe('module');
    expect(
      symbols.some(
        (symbol) =>
          symbol.name === 'UserViewSet' && symbol.type === CodeSymbolType.CLASS,
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
        (symbol) =>
          symbol.name === 'handle_task' &&
          symbol.type === CodeSymbolType.FUNCTION &&
          symbol.isAsync,
      ),
    ).toBe(true);
    expect(
      relations.some((relation) => relation.toSymbolQualifiedName === 'models'),
    ).toBe(true);
  });

  it('extracts PHP class, method, and use relations', () => {
    const source = `<?php
namespace App\\Http\\Controllers;
use App\\Models\\User;

class UserController {
    public function index() {
        return User::all();
    }
}
`;
    const filePath = 'app/Http/Controllers/UserController.php';
    const ast = parser.parse(
      {
        absolutePath: `/repo/${filePath}`,
        relativePath: filePath,
        language: 'php',
        extension: '.php',
        size: source.length,
        checksum: 'php',
      },
      source,
    );

    const symbols = extractor.extract(filePath, ast);
    const relations = registry
      .getByLanguage('php')!
      .extractRelations({ filePath, ast, symbols });

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
          symbol.name === 'index' && symbol.type === CodeSymbolType.METHOD,
      ),
    ).toBe(true);
    expect(
      relations.some((relation) =>
        relation.toSymbolQualifiedName.includes('User'),
      ),
    ).toBe(true);
  });
});
