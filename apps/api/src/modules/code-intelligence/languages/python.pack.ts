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

let pythonGrammar: unknown;

function loadPythonGrammar(): unknown {
  if (!pythonGrammar) {
    const loaded = loadNativeGrammar('tree-sitter-python');
    if (loaded && typeof loaded === 'object' && 'language' in loaded) {
      pythonGrammar = loaded;
    } else if (loaded && typeof loaded === 'object' && 'python' in loaded) {
      pythonGrammar = loaded.python;
    } else {
      pythonGrammar = loaded;
    }
  }
  return pythonGrammar;
}

function isPublicName(name: string): boolean {
  return !name.startsWith('_');
}

function isAsyncDef(node: AstNode): boolean {
  return /^\s*async\b/.test(node.text) || /\basync\s+def\b/.test(node.text);
}

function extractPythonSymbols(
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
    inClass: boolean,
  ): void => {
    if (node.type === 'decorated_definition') {
      const inner =
        childByField(node, 'definition') ??
        node.children.find(
          (child) =>
            child.type === 'class_definition' ||
            child.type === 'function_definition',
        );
      if (inner) {
        walk(inner, parentLocalId, parentQualifiedName, inClass);
      }
      return;
    }

    if (node.type === 'class_definition') {
      const name = nameOf(node);
      if (name) {
        const symbol = makeSymbol({
          node,
          filePath,
          language: ast.language,
          name,
          type: CodeSymbolType.CLASS,
          exported: isPublicName(name),
          parentLocalId,
          parentQualifiedName,
        });
        symbols.push(symbol);
        const body =
          childByField(node, 'body') ??
          node.children.find((child) => child.type === 'block');
        if (body) {
          for (const child of body.children) {
            walk(child, symbol.localId, symbol.qualifiedName, true);
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
            type: inClass ? CodeSymbolType.METHOD : CodeSymbolType.FUNCTION,
            exported: isPublicName(name),
            parentLocalId,
            parentQualifiedName,
            isAsync: isAsyncDef(node),
          }),
        );
      }
      return;
    }

    if (
      !inClass &&
      parentLocalId === moduleSymbol.localId &&
      node.type === 'expression_statement'
    ) {
      const assignment = node.children.find(
        (child) => child.type === 'assignment',
      );
      if (assignment) {
        const left = childByField(assignment, 'left') ?? assignment.children[0];
        if (left?.type === 'identifier') {
          const name = left.text;
          symbols.push(
            makeSymbol({
              node: assignment,
              filePath,
              language: ast.language,
              name,
              type: /^[A-Z][A-Z0-9_]*$/.test(name)
                ? CodeSymbolType.CONSTANT
                : CodeSymbolType.VARIABLE,
              exported: isPublicName(name),
              parentLocalId,
              parentQualifiedName,
            }),
          );
        }
      }
    }

    for (const child of node.children) {
      walk(child, parentLocalId, parentQualifiedName, inClass);
    }
  };

  for (const child of ast.tree.root.children) {
    walk(child, moduleSymbol.localId, moduleSymbol.qualifiedName, false);
  }

  return symbols;
}

function dottedNameText(node: AstNode): string {
  return node.text.trim();
}

function extractPythonRelations(params: {
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

  const walk = (node: AstNode): void => {
    if (node.type === 'import_statement') {
      const names = node.children.filter(
        (child) =>
          child.type === 'dotted_name' || child.type === 'aliased_import',
      );
      for (const nameNode of names) {
        const target =
          nameNode.type === 'aliased_import'
            ? (childByField(nameNode, 'name') ?? nameNode.children[0])
            : nameNode;
        if (target) {
          add({
            relationType: SymbolRelationType.IMPORTS,
            fromSymbolLocalId: moduleSymbol.localId,
            toSymbolQualifiedName: dottedNameText(target),
          });
        }
      }
    }

    if (node.type === 'import_from_statement') {
      const moduleName =
        childByField(node, 'module_name') ??
        node.children.find((child) => child.type === 'dotted_name');
      const imported = node.children.filter(
        (child) =>
          child.type === 'dotted_name' ||
          child.type === 'aliased_import' ||
          (child.type === 'identifier' && child.fieldName === 'name'),
      );
      const names =
        imported.length > 0
          ? imported
          : node.children.filter((child) => child.type === 'identifier');
      for (const nameNode of names) {
        if (moduleName && nameNode === moduleName) {
          continue;
        }
        add({
          relationType: SymbolRelationType.IMPORTS,
          fromSymbolLocalId: moduleSymbol.localId,
          toSymbolQualifiedName: dottedNameText(nameNode),
          targetFilePath: moduleName ? dottedNameText(moduleName) : undefined,
        });
      }
    }

    if (node.type === 'class_definition') {
      const owner = params.symbols.find(
        (symbol) =>
          symbol.type === CodeSymbolType.CLASS &&
          symbol.startLine === node.range.start.line &&
          symbol.filePath === params.filePath,
      );
      const superclasses =
        childByField(node, 'superclasses') ??
        node.children.find((child) => child.type === 'argument_list');
      if (owner && superclasses) {
        for (const child of superclasses.children) {
          if (
            child.type === 'identifier' ||
            child.type === 'attribute' ||
            child.type === 'dotted_name'
          ) {
            add({
              relationType: SymbolRelationType.EXTENDS,
              fromSymbolLocalId: owner.localId,
              toSymbolQualifiedName: dottedNameText(child),
            });
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

export const pythonLanguagePack: LanguagePack = {
  id: PROGRAMMING_LANGUAGES.python,
  languages: [PROGRAMMING_LANGUAGES.python],
  extensions: {
    '.py': PROGRAMMING_LANGUAGES.python,
    '.pyi': PROGRAMMING_LANGUAGES.python,
  },
  ignoreFolders: [
    '__pycache__',
    '.venv',
    'venv',
    '.tox',
    '.mypy_cache',
    '.pytest_cache',
  ],
  manifestBasenames: [
    'pyproject.toml',
    'requirements.txt',
    'Pipfile',
    'poetry.lock',
  ],
  manifestPathPatterns: [/(^|\/)requirements[^/]*\.txt$/i],
  topologyHints: {
    entryFileStems: [],
    entryBasenames: ['manage.py', 'wsgi.py', 'asgi.py', '__main__.py'],
    entryPathPatterns: [],
    highConfidenceEntryStems: [],
    highConfidenceEntryBasenames: ['manage.py', 'wsgi.py', 'asgi.py'],
    serviceSuffixes: ['ViewSet', 'Serializer', 'Task', 'Celery', 'Handler'],
    techMarkers: [
      {
        pattern: /(^|\/)(pyproject\.toml|requirements[^/]*\.txt)$/i,
        name: 'Python package ecosystem',
        category: 'runtime',
      },
      {
        pattern: /(^|\/)(Pipfile|poetry\.lock)$/,
        name: 'Python package manager',
        category: 'tooling',
      },
    ],
  },
  resolveGrammar() {
    return loadPythonGrammar();
  },
  extractSymbols: extractPythonSymbols,
  extractRelations: extractPythonRelations,
};
