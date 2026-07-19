import { ProgrammingLanguage } from './programming-language.type';

export interface AstNodePosition {
  line: number;
  column: number;
}

export interface AstNodeRange {
  start: AstNodePosition;
  end: AstNodePosition;
}

export interface AstNode {
  type: string;
  text: string;
  range: AstNodeRange;
  children: AstNode[];
}

export interface AstTree {
  root: AstNode;
}

export interface ParsedFileAst {
  language: ProgrammingLanguage;
  source: string;
  tree: AstTree;
}
