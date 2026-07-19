import { ProgrammingLanguage } from './programming-language.type';

export interface RepositoryFileCandidate {
  absolutePath: string;
  relativePath: string;
  language: ProgrammingLanguage;
  extension: string;
  size: number;
  checksum: string;
}
