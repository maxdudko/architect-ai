import { CodeSymbolType, SymbolRelationType } from '@prisma/client';
import { AstNode, ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';
import {
  childByField,
  createModuleSymbol,
  makeSymbol,
  nameOf,
} from './ast-helpers';
import type { LanguagePack } from './language-pack';
import { loadNativeGrammar } from './load-native-grammar';

let phpGrammar: unknown;

function loadPhpGrammar(): unknown {
  if (!phpGrammar) {
    const loaded = loadNativeGrammar('tree-sitter-php');
    if (loaded && typeof loaded === 'object') {
      const php = 'php' in loaded ? loaded.php : undefined;
      const phpOnly = 'php_only' in loaded ? loaded.php_only : undefined;
      phpGrammar = php ?? phpOnly ?? loaded;
    } else {
      phpGrammar = loaded;
    }
  }
  return phpGrammar;
}

function phpVisibility(node: AstNode): string {
  if (/\bprivate\b/.test(node.text)) {
    return 'private';
  }
  if (/\bprotected\b/.test(node.text)) {
    return 'protected';
  }
  return 'public';
}

function phpExported(node: AstNode, name: string): boolean {
  if (name.startsWith('_')) {
    return false;
  }
  const visibility = phpVisibility(node);
  return visibility === 'public';
}

function extractPhpSymbols(
  filePath: string,
  ast: ParsedFileAst,
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const moduleSymbol = createModuleSymbol(
    filePath,
    ast.language,
    ast.tree.root,
  );
  symbols.push(moduleSymbol);

  const walk = (
    node: AstNode,
    parentLocalId: string | null,
    parentQualifiedName: string | null,
  ): void => {
    if (node.type === 'namespace_definition') {
      const name = nameOf(node);
      if (name) {
        const symbol = makeSymbol({
          node,
          filePath,
          language: ast.language,
          name,
          type: CodeSymbolType.NAMESPACE,
          exported: true,
          parentLocalId,
          parentQualifiedName,
        });
        symbols.push(symbol);
        const body =
          childByField(node, 'body') ??
          node.children.find(
            (child) =>
              child.type === 'compound_statement' ||
              child.type === 'declaration_list',
          );
        if (body) {
          for (const child of body.children) {
            walk(child, symbol.localId, symbol.qualifiedName);
          }
          return;
        }
      }
    }

    if (
      node.type === 'class_declaration' ||
      node.type === 'trait_declaration' ||
      node.type === 'interface_declaration'
    ) {
      const name = nameOf(node);
      if (name) {
        const type =
          node.type === 'interface_declaration'
            ? CodeSymbolType.INTERFACE
            : CodeSymbolType.CLASS;
        const symbol = makeSymbol({
          node,
          filePath,
          language: ast.language,
          name,
          type,
          exported: phpExported(node, name),
          parentLocalId,
          parentQualifiedName,
          visibility: phpVisibility(node),
        });
        symbols.push(symbol);
        const body =
          childByField(node, 'body') ??
          node.children.find(
            (child) =>
              child.type === 'declaration_list' ||
              child.type === 'compound_statement',
          );
        if (body) {
          for (const child of body.children) {
            walk(child, symbol.localId, symbol.qualifiedName);
          }
        }
      }
      return;
    }

    if (node.type === 'function_definition') {
      const name = nameOf(node);
      if (name) {
        symbols.push(
          makeSymbol({
            node,
            filePath,
            language: ast.language,
            name,
            type: CodeSymbolType.FUNCTION,
            exported: true,
            parentLocalId,
            parentQualifiedName,
            visibility: 'public',
          }),
        );
      }
      return;
    }

    if (node.type === 'method_declaration') {
      const name = nameOf(node);
      if (name) {
        symbols.push(
          makeSymbol({
            node,
            filePath,
            language: ast.language,
            name,
            type: CodeSymbolType.METHOD,
            exported: phpExported(node, name),
            parentLocalId,
            parentQualifiedName,
            isStatic: /\bstatic\b/.test(node.text),
            visibility: phpVisibility(node),
          }),
        );
      }
      return;
    }

    for (const child of node.children) {
      walk(child, parentLocalId, parentQualifiedName);
    }
  };

  for (const child of ast.tree.root.children) {
    walk(child, moduleSymbol.localId, moduleSymbol.qualifiedName);
  }

  return symbols;
}

function qualifiedNameText(node: AstNode): string {
  return node.text.replace(/^\\/, '').trim();
}

function extractPhpRelations(params: {
  filePath: string;
  ast: ParsedFileAst;
  symbols: ExtractedSymbol[];
}): ExtractedSymbolRelationship[] {
  const moduleSymbol = params.symbols.find(
    (symbol) => symbol.parentLocalId === null,
  );
  if (!moduleSymbol) {
    return [];
  }

  const relationships: ExtractedSymbolRelationship[] = [];
  const dedupe = new Set<string>();
  const add = (relationship: ExtractedSymbolRelationship): void => {
    const key = `${relationship.relationType}:${relationship.fromSymbolLocalId}:${relationship.toSymbolQualifiedName}`;
    if (dedupe.has(key)) {
      return;
    }
    dedupe.add(key);
    relationships.push(relationship);
  };

  const ownerAt = (line: number): ExtractedSymbol | null => {
    const owners = params.symbols.filter(
      (symbol) => symbol.startLine <= line && symbol.endLine >= line,
    );
    if (owners.length === 0) {
      return null;
    }
    owners.sort(
      (left, right) =>
        left.endLine - left.startLine - (right.endLine - right.startLine),
    );
    return owners[0] ?? null;
  };

  const walk = (node: AstNode): void => {
    if (
      node.type === 'namespace_use_declaration' ||
      node.type === 'namespace_use_clause'
    ) {
      const names = node.children.filter(
        (child) =>
          child.type === 'namespace_name' ||
          child.type === 'qualified_name' ||
          child.type === 'name',
      );
      for (const nameNode of names) {
        add({
          relationType: SymbolRelationType.IMPORTS,
          fromSymbolLocalId: moduleSymbol.localId,
          toSymbolQualifiedName: qualifiedNameText(nameNode),
        });
      }
    }

    if (
      node.type === 'class_declaration' ||
      node.type === 'interface_declaration'
    ) {
      const owner = ownerAt(node.range.start.line);
      if (owner) {
        const base =
          childByField(node, 'base') ??
          node.children.find((child) => child.type === 'base_clause');
        if (base) {
          for (const child of base.children) {
            if (
              child.type === 'name' ||
              child.type === 'qualified_name' ||
              child.type === 'namespace_name'
            ) {
              add({
                relationType: SymbolRelationType.EXTENDS,
                fromSymbolLocalId: owner.localId,
                toSymbolQualifiedName: qualifiedNameText(child),
              });
            }
          }
        }

        const interfaces =
          childByField(node, 'interfaces') ??
          node.children.find(
            (child) => child.type === 'class_interface_clause',
          );
        if (interfaces) {
          for (const child of interfaces.children) {
            if (
              child.type === 'name' ||
              child.type === 'qualified_name' ||
              child.type === 'namespace_name'
            ) {
              add({
                relationType: SymbolRelationType.IMPLEMENTS,
                fromSymbolLocalId: owner.localId,
                toSymbolQualifiedName: qualifiedNameText(child),
              });
            }
          }
        }
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(params.ast.tree.root);
  return relationships;
}

export const phpLanguagePack: LanguagePack = {
  id: PROGRAMMING_LANGUAGES.php,
  languages: [PROGRAMMING_LANGUAGES.php],
  extensions: {
    '.php': PROGRAMMING_LANGUAGES.php,
    '.phtml': PROGRAMMING_LANGUAGES.php,
  },
  ignoreFolders: ['vendor'],
  manifestBasenames: ['composer.json', 'composer.lock', 'artisan'],
  manifestPathPatterns: [],
  topologyHints: {
    entryFileStems: [],
    entryBasenames: ['artisan', 'index.php'],
    entryPathPatterns: [/(^|\/)public\/index\.php$/],
    highConfidenceEntryStems: [],
    highConfidenceEntryBasenames: ['artisan', 'index.php'],
    serviceSuffixes: [
      'Controller',
      'Job',
      'Listener',
      'Policy',
      'Middleware',
      'Resource',
      'FormRequest',
      'Service',
      'Repository',
    ],
    techMarkers: [
      {
        pattern: /(^|\/)composer\.(json|lock)$/,
        name: 'PHP Composer',
        category: 'runtime',
      },
      {
        pattern: /(^|\/)artisan$/,
        name: 'Laravel',
        category: 'framework',
      },
    ],
  },
  resolveGrammar() {
    return loadPhpGrammar();
  },
  extractSymbols: extractPhpSymbols,
  extractRelations: extractPhpRelations,
};
