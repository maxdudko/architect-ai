import type { SyntaxNode, Tree } from 'tree-sitter';
import { AstNode, AstTree } from '../types/ast.type';

function mapNode(node: SyntaxNode): AstNode {
  const children: AstNode[] = [];
  const childCount = node.childCount;
  const getChild = node.child?.bind(node);

  if (typeof childCount === 'number' && getChild) {
    for (let index = 0; index < childCount; index += 1) {
      const child = getChild(index);
      if (!child) {
        continue;
      }
      if (child.isNamed === false) {
        continue;
      }
      const mapped = mapNode(child);
      const fieldName = node.fieldNameForChild?.(index) ?? undefined;
      children.push(fieldName ? { ...mapped, fieldName } : mapped);
    }
  } else {
    for (const child of node.namedChildren ?? []) {
      if (child) {
        children.push(mapNode(child));
      }
    }
  }

  return {
    type: node.type,
    text: node.text,
    range: {
      start: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      },
      end: {
        line: node.endPosition.row + 1,
        column: node.endPosition.column + 1,
      },
    },
    children,
  };
}

export class TreeSitterAstAdapter {
  toAstTree(tree: Tree): AstTree {
    return {
      root: mapNode(tree.rootNode),
    };
  }
}
