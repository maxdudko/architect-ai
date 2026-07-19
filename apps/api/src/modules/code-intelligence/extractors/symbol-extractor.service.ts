import { Injectable } from '@nestjs/common';
import { CodeSymbolType } from '@prisma/client';
import { SymbolExtractor } from '../interfaces/symbol-extractor.interface';
import { ParsedFileAst, AstNode } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';

interface SymbolContext {
  parentLocalId: string | null;
  parentQualifiedName: string | null;
  exported: boolean;
}

@Injectable()
export class SymbolExtractorService implements SymbolExtractor {
  extract(filePath: string, ast: ParsedFileAst): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    const moduleLocalId = `module:${filePath}`;
    const moduleQualifiedName = filePath;
    symbols.push({
      localId: moduleLocalId,
      name: filePath.split('/').pop() ?? filePath,
      qualifiedName: moduleQualifiedName,
      type: CodeSymbolType.MODULE,
      language: ast.language,
      filePath,
      startLine: ast.tree.root.range.start.line,
      endLine: ast.tree.root.range.end.line,
      startColumn: ast.tree.root.range.start.column,
      endColumn: ast.tree.root.range.end.column,
      exported: true,
      isAsync: false,
      isStatic: false,
      visibility: 'module',
      parentLocalId: null,
    });

    for (const child of ast.tree.root.children) {
      this.walkNode(child, symbols, {
        parentLocalId: moduleLocalId,
        parentQualifiedName: moduleQualifiedName,
        exported: false,
      });
    }

    return symbols;
  }

  private walkNode(
    node: AstNode,
    symbols: ExtractedSymbol[],
    context: SymbolContext,
  ): void {
    const isExportedContext =
      context.exported || node.type === 'export_statement';

    const declaration = this.extractDeclaration(
      node,
      context,
      isExportedContext,
    );
    if (declaration.length > 0) {
      for (const symbol of declaration) {
        symbols.push(symbol);
        for (const child of node.children) {
          this.walkNode(child, symbols, {
            parentLocalId: symbol.localId,
            parentQualifiedName: symbol.qualifiedName,
            exported: isExportedContext,
          });
        }
      }
      return;
    }

    for (const child of node.children) {
      this.walkNode(child, symbols, {
        ...context,
        exported: isExportedContext,
      });
    }
  }

  private extractDeclaration(
    node: AstNode,
    context: SymbolContext,
    isExported: boolean,
  ): ExtractedSymbol[] {
    if (node.type === 'class_declaration') {
      const name = this.extractIdentifier(
        node.text,
        /\bclass\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
              node,
              context,
              name,
              CodeSymbolType.CLASS,
              isExported,
            ),
          ]
        : [];
    }

    if (node.type === 'interface_declaration') {
      const name = this.extractIdentifier(
        node.text,
        /\binterface\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
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
      const name = this.extractIdentifier(
        node.text,
        /\bfunction\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
              node,
              context,
              name,
              CodeSymbolType.FUNCTION,
              isExported,
            ),
          ]
        : [];
    }

    if (node.type === 'method_definition') {
      const name = this.extractIdentifier(
        node.text,
        /(?:get|set)?\s*(?:async\s+)?(?:static\s+)?([A-Za-z_$][\w$]*)\s*\(/,
      );
      return name
        ? [
            this.makeSymbol(
              node,
              context,
              name,
              CodeSymbolType.METHOD,
              isExported,
            ),
          ]
        : [];
    }

    if (node.type === 'enum_declaration') {
      const name = this.extractIdentifier(
        node.text,
        /\benum\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
              node,
              context,
              name,
              CodeSymbolType.ENUM,
              isExported,
            ),
          ]
        : [];
    }

    if (node.type === 'type_alias_declaration') {
      const name = this.extractIdentifier(
        node.text,
        /\btype\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
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
      const name = this.extractIdentifier(
        node.text,
        /\b(?:namespace|module)\s+([A-Za-z_$][\w$]*)/,
      );
      return name
        ? [
            this.makeSymbol(
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
      const names = this.extractVariableNames(node.text);
      const isConst = /\bconst\b/.test(node.text);
      return names.map((name) =>
        this.makeSymbol(
          node,
          context,
          name,
          isConst ? CodeSymbolType.CONSTANT : CodeSymbolType.VARIABLE,
          isExported,
        ),
      );
    }

    return [];
  }

  private makeSymbol(
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
      language: 'typescript',
      filePath: '',
      startLine: node.range.start.line,
      endLine: node.range.end.line,
      startColumn: node.range.start.column,
      endColumn: node.range.end.column,
      exported,
      isAsync: /\basync\b/.test(node.text),
      isStatic: /\bstatic\b/.test(node.text),
      visibility: this.extractVisibility(node.text),
      parentLocalId: context.parentLocalId,
    };
  }

  private extractVisibility(text: string): string {
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

  private extractIdentifier(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match?.[1] ?? null;
  }

  private extractVariableNames(text: string): string[] {
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
}
