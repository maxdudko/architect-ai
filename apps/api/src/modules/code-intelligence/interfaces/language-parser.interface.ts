import { ParsedFileAst } from '../types/ast.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';

export interface LanguageParser {
  supports(language: string): boolean;
  parse(file: RepositoryFileCandidate, source: string): ParsedFileAst;
}
