import { CodeSymbolType, SymbolRelationType } from '@prisma/client';
import { AstNode, ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';
import { createModuleSymbol } from './ast-helpers';
import type { LanguagePack } from './language-pack';
import { loadNativeGrammar } from './load-native-grammar';

const FUNCTION_VALUE_NODE_TYPES = new Set([
  'arrow_function',
  'function',
  'function_expression',
]);

interface SymbolContext {
  filePath: string;
  language: ExtractedSymbol['language'];
  parentLocalId: string | null;
  parentQualifiedName: string | null;
  exported: boolean;
}

let cachedGrammars:
  | {
      typescript: unknown;
      tsx: unknown;
      javascript: unknown;
    }
  | undefined;

function loadGrammars() {
  if (cachedGrammars) {
    return cachedGrammars;
  }

  const TypeScript = loadNativeGrammar('tree-sitter-typescript') as {
    typescript: unknown;
    tsx: unknown;
  };
  const JavaScript = loadNativeGrammar('tree-sitter-javascript') as unknown;
  cachedGrammars = {
    typescript: TypeScript.typescript,
    tsx: TypeScript.tsx,
    javascript: JavaScript,
  };
  return cachedGrammars;
}

function extractJavascriptSymbols(
  filePath: string,
  ast: ParsedFileAst,
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const moduleSymbol = createModuleSymbol(
    filePath,
    ast.language,
    ast.tree.root,
  );
  const rootContext: SymbolContext = {
    filePath,
    language: ast.language,
    parentLocalId: null,
    parentQualifiedName: null,
    exported: false,
  };

  symbols.push(moduleSymbol);

  for (const child of ast.tree.root.children) {
    walkNode(child, symbols, {
      ...rootContext,
      parentLocalId: moduleSymbol.localId,
      parentQualifiedName: moduleSymbol.qualifiedName,
    });
  }

  return symbols;
}

function walkNode(
  node: AstNode,
  symbols: ExtractedSymbol[],
  context: SymbolContext,
): void {
  const isExportedContext =
    context.exported || node.type === 'export_statement';

  const declaration = extractDeclaration(
    node,
    { ...context, exported: isExportedContext },
    isExportedContext,
  );
  if (declaration.length > 0) {
    for (const symbol of declaration) {
      symbols.push(symbol);
      for (const child of node.children) {
        walkNode(child, symbols, {
          ...context,
          parentLocalId: symbol.localId,
          parentQualifiedName: symbol.qualifiedName,
          exported: isExportedContext,
        });
      }
    }
    return;
  }

  for (const child of node.children) {
    walkNode(child, symbols, {
      ...context,
      exported: isExportedContext,
    });
  }
}

function extractDeclaration(
  node: AstNode,
  context: SymbolContext,
  isExported: boolean,
): ExtractedSymbol[] {
  if (node.type === 'class_declaration') {
    const name = extractIdentifier(node.text, /\bclass\s+([A-Za-z_$][\w$]*)/);
    return name
      ? [makeJsSymbol(node, context, name, CodeSymbolType.CLASS, isExported)]
      : [];
  }

  if (node.type === 'interface_declaration') {
    const name = extractIdentifier(
      node.text,
      /\binterface\s+([A-Za-z_$][\w$]*)/,
    );
    return name
      ? [
          makeJsSymbol(
            node,
            context,
            name,
            CodeSymbolType.INTERFACE,
            isExported,
          ),
        ]
      : [];
  }

  if (node.type === 'function_declaration') {
    const name = extractIdentifier(
      node.text,
      /\bfunction\s+([A-Za-z_$][\w$]*)/,
    );
    return name
      ? [makeJsSymbol(node, context, name, CodeSymbolType.FUNCTION, isExported)]
      : [];
  }

  if (node.type === 'method_definition') {
    const name = extractIdentifier(
      node.text,
      /(?:get|set)?\s*(?:async\s+)?(?:static\s+)?([A-Za-z_$][\w$]*)\s*\(/,
    );
    return name
      ? [makeJsSymbol(node, context, name, CodeSymbolType.METHOD, isExported)]
      : [];
  }

  if (node.type === 'enum_declaration') {
    const name = extractIdentifier(node.text, /\benum\s+([A-Za-z_$][\w$]*)/);
    return name
      ? [makeJsSymbol(node, context, name, CodeSymbolType.ENUM, isExported)]
      : [];
  }

  if (node.type === 'type_alias_declaration') {
    const name = extractIdentifier(node.text, /\btype\s+([A-Za-z_$][\w$]*)/);
    return name
      ? [
          makeJsSymbol(
            node,
            context,
            name,
            CodeSymbolType.TYPE_ALIAS,
            isExported,
          ),
        ]
      : [];
  }

  if (
    node.type === 'internal_module' ||
    node.type === 'namespace_declaration'
  ) {
    const name = extractIdentifier(
      node.text,
      /\b(?:namespace|module)\s+([A-Za-z_$][\w$]*)/,
    );
    return name
      ? [
          makeJsSymbol(
            node,
            context,
            name,
            CodeSymbolType.NAMESPACE,
            isExported,
          ),
        ]
      : [];
  }

  if (
    node.type === 'lexical_declaration' ||
    node.type === 'variable_declaration' ||
    node.type === 'variable_statement'
  ) {
    return extractVariableLikeSymbols(node, context, isExported);
  }

  return [];
}

function extractVariableLikeSymbols(
  node: AstNode,
  context: SymbolContext,
  isExported: boolean,
): ExtractedSymbol[] {
  const isConst = /\bconst\b/.test(node.text);
  const declarators = findNodesByType(node, 'variable_declarator');

  if (declarators.length > 0) {
    const symbols: ExtractedSymbol[] = [];
    for (const declarator of declarators) {
      const nameNode = declarator.children.find(
        (child) => child.type === 'identifier',
      );
      const name =
        nameNode?.text ??
        extractIdentifier(declarator.text, /^([A-Za-z_$][\w$]*)/);
      if (!name) {
        continue;
      }

      const isFunctionValue = declarator.children.some((child) =>
        FUNCTION_VALUE_NODE_TYPES.has(child.type),
      );
      const type = isFunctionValue
        ? CodeSymbolType.FUNCTION
        : isConst
          ? CodeSymbolType.CONSTANT
          : CodeSymbolType.VARIABLE;

      symbols.push(makeJsSymbol(declarator, context, name, type, isExported));
    }
    return symbols;
  }

  const names = extractVariableNames(node.text);
  return names.map((name) =>
    makeJsSymbol(
      node,
      context,
      name,
      isConst ? CodeSymbolType.CONSTANT : CodeSymbolType.VARIABLE,
      isExported,
    ),
  );
}

function makeJsSymbol(
  node: AstNode,
  context: SymbolContext,
  name: string,
  type: CodeSymbolType,
  exported: boolean,
): ExtractedSymbol {
  const qualifiedName = context.parentQualifiedName
    ? `${context.parentQualifiedName}.${name}`
    : name;

  return {
    localId: `${qualifiedName}:${node.range.start.line}:${node.range.start.column}`,
    name,
    qualifiedName,
    type,
    language: context.language,
    filePath: context.filePath,
    startLine: node.range.start.line,
    endLine: node.range.end.line,
    startColumn: node.range.start.column,
    endColumn: node.range.end.column,
    exported,
    isAsync: /\basync\b/.test(node.text),
    isStatic: /\bstatic\b/.test(node.text),
    visibility: extractVisibility(node.text),
    parentLocalId: context.parentLocalId,
  };
}

function findNodesByType(node: AstNode, type: string): AstNode[] {
  const matches: AstNode[] = [];
  const stack: AstNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current.type === type) {
      matches.push(current);
    }
    for (const child of current.children) {
      stack.push(child);
    }
  }
  return matches;
}

function extractVisibility(text: string): string {
  if (/\bprivate\b/.test(text)) {
    return 'private';
  }
  if (/\bprotected\b/.test(text)) {
    return 'protected';
  }
  if (/\bpublic\b/.test(text)) {
    return 'public';
  }
  return 'default';
}

function extractIdentifier(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function extractVariableNames(text: string): string[] {
  const out = new Set<string>();
  const declarationWithoutKeyword = text.replace(
    /^\s*(?:const|let|var)\s+/,
    '',
  );
  const matches = declarationWithoutKeyword.matchAll(
    /([A-Za-z_$][\w$]*)\s*(?::|=|,|;|$)/g,
  );
  for (const match of matches) {
    const name = match[1];
    if (name) {
      out.add(name);
    }
  }
  return [...out];
}

function extractJavascriptRelations(params: {
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
    const key = `${relationship.relationType}:${relationship.fromSymbolLocalId}:${relationship.toSymbolLocalId ?? relationship.toSymbolQualifiedName}`;
    if (dedupe.has(key)) {
      return;
    }
    dedupe.add(key);
    relationships.push(relationship);
  };

  const walk = (node: AstNode): void => {
    if (node.type === 'import_statement') {
      const source = extractImportSource(node.text);
      for (const importedName of extractIdentifiers(node.text)) {
        add({
          relationType: SymbolRelationType.IMPORTS,
          fromSymbolLocalId: moduleSymbol.localId,
          toSymbolQualifiedName: importedName,
          targetFilePath: source ?? undefined,
        });
      }
    }

    if (node.type === 'export_statement') {
      for (const exportedName of extractIdentifiers(node.text)) {
        add({
          relationType: SymbolRelationType.EXPORTS,
          fromSymbolLocalId: moduleSymbol.localId,
          toSymbolQualifiedName: exportedName,
        });
      }
    }

    if (
      node.type === 'class_declaration' ||
      node.type === 'interface_declaration'
    ) {
      const owner = findOwnerSymbol(params.symbols, node.range.start.line);
      if (owner) {
        for (const targetName of extractHeritage(node.text, 'extends')) {
          add({
            relationType: SymbolRelationType.EXTENDS,
            fromSymbolLocalId: owner.localId,
            toSymbolQualifiedName: targetName,
          });
        }
        for (const targetName of extractHeritage(node.text, 'implements')) {
          add({
            relationType: SymbolRelationType.IMPLEMENTS,
            fromSymbolLocalId: owner.localId,
            toSymbolQualifiedName: targetName,
          });
        }
      }
    }

    if (node.type === 'call_expression') {
      const owner = findOwnerSymbol(params.symbols, node.range.start.line);
      const calledName = extractCallName(node.text);
      if (owner && calledName) {
        add({
          relationType: SymbolRelationType.CALLS,
          fromSymbolLocalId: owner.localId,
          toSymbolQualifiedName: calledName,
        });
      }
    }

    if (node.type === 'new_expression') {
      const owner = findOwnerSymbol(params.symbols, node.range.start.line);
      const usedName = extractNewIdentifier(node.text);
      if (owner && usedName) {
        add({
          relationType: SymbolRelationType.USES,
          fromSymbolLocalId: owner.localId,
          toSymbolQualifiedName: usedName,
        });
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(params.ast.tree.root);
  return relationships;
}

function extractIdentifiers(text: string): string[] {
  const out = new Set<string>();
  const matches = text.matchAll(/[A-Za-z_$][\w$]*/g);
  const ignored = new Set([
    'import',
    'from',
    'as',
    'type',
    'export',
    'default',
    'class',
    'interface',
    'function',
    'extends',
    'implements',
    'new',
  ]);
  for (const match of matches) {
    const value = match[0];
    if (!ignored.has(value)) {
      out.add(value);
    }
  }
  return [...out];
}

function extractImportSource(text: string): string | null {
  const match = text.match(/from\s+['"]([^'"]+)['"]/);
  return match?.[1] ?? null;
}

function extractHeritage(
  text: string,
  keyword: 'extends' | 'implements',
): string[] {
  const pattern = new RegExp(`${keyword}\\s+([^\\{]+)`);
  const match = text.match(pattern);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/[^A-Za-z0-9_$.]/g, ''))
    .filter(Boolean);
}

function extractCallName(text: string): string | null {
  const match = text.match(/([A-Za-z_$][\w$.]*)\s*\(/);
  return match?.[1] ?? null;
}

function extractNewIdentifier(text: string): string | null {
  const match = text.match(/\bnew\s+([A-Za-z_$][\w$]*)/);
  return match?.[1] ?? null;
}

function findOwnerSymbol(
  symbols: ExtractedSymbol[],
  line: number,
): ExtractedSymbol | null {
  const owners = symbols.filter(
    (symbol) => symbol.startLine <= line && symbol.endLine >= line,
  );

  if (owners.length === 0) {
    return null;
  }

  owners.sort((a, b) => {
    const spanA = a.endLine - a.startLine;
    const spanB = b.endLine - b.startLine;
    return spanA - spanB;
  });

  return owners[0] ?? null;
}

export const javascriptLanguagePack: LanguagePack = {
  id: PROGRAMMING_LANGUAGES.javascript,
  languages: [
    PROGRAMMING_LANGUAGES.javascript,
    PROGRAMMING_LANGUAGES.typescript,
  ],
  extensions: {
    '.ts': PROGRAMMING_LANGUAGES.typescript,
    '.tsx': PROGRAMMING_LANGUAGES.typescript,
    '.cts': PROGRAMMING_LANGUAGES.typescript,
    '.mts': PROGRAMMING_LANGUAGES.typescript,
    '.js': PROGRAMMING_LANGUAGES.javascript,
    '.jsx': PROGRAMMING_LANGUAGES.javascript,
    '.cjs': PROGRAMMING_LANGUAGES.javascript,
    '.mjs': PROGRAMMING_LANGUAGES.javascript,
  },
  ignoreFolders: ['node_modules', '.next'],
  manifestBasenames: [
    'package.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'nest-cli.json',
    'Dockerfile',
    'dockerfile',
  ],
  manifestPathPatterns: [
    /(^|\/)next\.config\.[^/]+$/i,
    /(^|\/)prisma\/schema\.prisma$/,
  ],
  topologyHints: {
    entryFileStems: [
      'main',
      'index',
      'server',
      'app',
      'bootstrap',
      'worker',
      'cli',
      'application',
    ],
    entryBasenames: [],
    entryPathPatterns: [],
    highConfidenceEntryStems: ['main', 'server', 'bootstrap'],
    highConfidenceEntryBasenames: [],
    serviceSuffixes: [
      'Service',
      'Controller',
      'Repository',
      'Provider',
      'Client',
      'Worker',
      'Processor',
      'Handler',
      'Gateway',
    ],
    techMarkers: [
      {
        pattern: /(^|\/)package\.json$/,
        name: 'Node.js package ecosystem',
        category: 'runtime',
      },
      {
        pattern: /(^|\/)(pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/,
        name: 'JavaScript package manager',
        category: 'tooling',
      },
      {
        pattern: /(^|\/)nest-cli\.json$/,
        name: 'NestJS',
        category: 'framework',
      },
      {
        pattern: /(^|\/)next\.config\./,
        name: 'Next.js',
        category: 'framework',
      },
      {
        pattern: /(^|\/)prisma\/schema\.prisma$/,
        name: 'Prisma',
        category: 'data',
      },
      {
        pattern: /(^|\/)dockerfile$/i,
        name: 'Docker',
        category: 'tooling',
      },
    ],
  },
  resolveGrammar(file) {
    const grammars = loadGrammars();
    if (file.extension.toLowerCase() === '.tsx') {
      return grammars.tsx;
    }
    if (file.language === PROGRAMMING_LANGUAGES.javascript) {
      return grammars.javascript;
    }
    return grammars.typescript;
  },
  extractSymbols: extractJavascriptSymbols,
  extractRelations: extractJavascriptRelations,
};
