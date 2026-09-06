declare module 'tree-sitter' {
  export interface ParserPoint {
    row: number;
    column: number;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: ParserPoint;
    endPosition: ParserPoint;
    namedChildren: SyntaxNode[];
    children?: SyntaxNode[];
    childCount?: number;
    isNamed?: boolean;
    child?(index: number): SyntaxNode | null;
    fieldNameForChild?(index: number): string | null;
    childForFieldName?(name: string): SyntaxNode | null;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export default class Parser {
    static Language: unknown;
    setLanguage(language: unknown): void;
    parse(source: string): Tree;
  }
}

declare module 'tree-sitter-javascript' {
  const javascriptLanguage: unknown;
  export = javascriptLanguage;
}

declare module 'tree-sitter-typescript' {
  export const typescript: unknown;
  export const tsx: unknown;
}

declare module 'tree-sitter-python' {
  const pythonLanguage: unknown;
  export = pythonLanguage;
}

declare module 'tree-sitter-php' {
  export const php: unknown;
  export const php_only: unknown;
}
