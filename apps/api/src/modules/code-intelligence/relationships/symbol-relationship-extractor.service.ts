import { Injectable } from '@nestjs/common';
import { SymbolRelationType } from '@prisma/client';
import { SymbolRelationshipExtractor } from '../interfaces/symbol-relationship-extractor.interface';
import { AstNode, ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';

@Injectable()
export class SymbolRelationshipExtractorService implements SymbolRelationshipExtractor {
  extract(params: {
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
        const source = this.extractImportSource(node.text);
        for (const importedName of this.extractIdentifiers(node.text)) {
          add({
            relationType: SymbolRelationType.IMPORTS,
            fromSymbolLocalId: moduleSymbol.localId,
            toSymbolQualifiedName: importedName,
            targetFilePath: source ?? undefined,
          });
        }
      }

      if (node.type === 'export_statement') {
        for (const exportedName of this.extractIdentifiers(node.text)) {
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
        const owner = this.findOwnerSymbol(
          params.symbols,
          node.range.start.line,
        );
        if (owner) {
          for (const targetName of this.extractHeritage(node.text, 'extends')) {
            add({
              relationType: SymbolRelationType.EXTENDS,
              fromSymbolLocalId: owner.localId,
              toSymbolQualifiedName: targetName,
            });
          }
          for (const targetName of this.extractHeritage(
            node.text,
            'implements',
          )) {
            add({
              relationType: SymbolRelationType.IMPLEMENTS,
              fromSymbolLocalId: owner.localId,
              toSymbolQualifiedName: targetName,
            });
          }
        }
      }

      if (node.type === 'call_expression') {
        const owner = this.findOwnerSymbol(
          params.symbols,
          node.range.start.line,
        );
        const calledName = this.extractCallName(node.text);
        if (owner && calledName) {
          add({
            relationType: SymbolRelationType.CALLS,
            fromSymbolLocalId: owner.localId,
            toSymbolQualifiedName: calledName,
          });
        }
      }

      if (node.type === 'new_expression') {
        const owner = this.findOwnerSymbol(
          params.symbols,
          node.range.start.line,
        );
        const usedName = this.extractIdentifier(node.text);
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

  private extractIdentifiers(text: string): string[] {
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

  private extractImportSource(text: string): string | null {
    const match = text.match(/from\s+['"]([^'"]+)['"]/);
    return match?.[1] ?? null;
  }

  private extractHeritage(
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

  private extractCallName(text: string): string | null {
    const match = text.match(/([A-Za-z_$][\w$.]*)\s*\(/);
    return match?.[1] ?? null;
  }

  private extractIdentifier(text: string): string | null {
    const match = text.match(/\bnew\s+([A-Za-z_$][\w$]*)/);
    return match?.[1] ?? null;
  }

  private findOwnerSymbol(
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
}
