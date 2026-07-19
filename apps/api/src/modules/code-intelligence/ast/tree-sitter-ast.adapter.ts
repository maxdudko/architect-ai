import type { SyntaxNode, Tree } from 'tree-sitter';
import { AstNode, AstTree } from '../types/ast.type';

function mapNode(node: SyntaxNode): AstNode {
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
    children: (node.namedChildren ?? [])
      .filter((child): child is SyntaxNode => child != null)
      .map((child) => mapNode(child)),
  };
}

export class TreeSitterAstAdapter {
  toAstTree(tree: Tree): AstTree {
    return {
      root: mapNode(tree.rootNode),
    };
  }
}
