import { CodeSymbolType } from '@prisma/client';
import { AstNode } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { ProgrammingLanguage } from '../types/programming-language.type';

export function childByField(
  node: AstNode,
  field: string,
): AstNode | undefined {
  return node.children.find((child) => child.fieldName === field);
}

export function childrenByField(node: AstNode, field: string): AstNode[] {
  return node.children.filter((child) => child.fieldName === field);
}

export function nameOf(node: AstNode): string | null {
  const named = childByField(node, 'name');
  if (named) {
    return named.text.replace(/^\$/, '').trim() || null;
  }

  const identifier = node.children.find(
    (child) =>
      child.type === 'identifier' ||
      child.type === 'name' ||
      child.type === 'property_identifier' ||
      child.type === 'type_identifier' ||
      child.type === 'variable_name',
  );
  return identifier?.text.replace(/^\$/, '').trim() || null;
}

export function createModuleSymbol(
  filePath: string,
  language: ProgrammingLanguage,
  root: AstNode,
): ExtractedSymbol {
  return {
    localId: `module:${filePath}`,
    name: filePath.split('/').pop() ?? filePath,
    qualifiedName: filePath,
    type: CodeSymbolType.MODULE,
    language,
    filePath,
    startLine: root.range.start.line,
    endLine: root.range.end.line,
    startColumn: root.range.start.column,
    endColumn: root.range.end.column,
    exported: true,
    isAsync: false,
    isStatic: false,
    visibility: 'module',
    parentLocalId: null,
  };
}

export function makeSymbol(params: {
  node: AstNode;
  filePath: string;
  language: ProgrammingLanguage;
  name: string;
  type: CodeSymbolType;
  exported: boolean;
  parentLocalId: string | null;
  parentQualifiedName: string | null;
  isAsync?: boolean;
  isStatic?: boolean;
  visibility?: string;
}): ExtractedSymbol {
  const qualifiedName = params.parentQualifiedName
    ? `${params.parentQualifiedName}.${params.name}`
    : params.name;

  return {
    localId: `${qualifiedName}:${params.node.range.start.line}:${params.node.range.start.column}`,
    name: params.name,
    qualifiedName,
    type: params.type,
    language: params.language,
    filePath: params.filePath,
    startLine: params.node.range.start.line,
    endLine: params.node.range.end.line,
    startColumn: params.node.range.start.column,
    endColumn: params.node.range.end.column,
    exported: params.exported,
    isAsync: params.isAsync ?? false,
    isStatic: params.isStatic ?? false,
    visibility: params.visibility ?? 'default',
    parentLocalId: params.parentLocalId,
  };
}
