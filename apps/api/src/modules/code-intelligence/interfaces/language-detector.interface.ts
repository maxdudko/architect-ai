import { ProgrammingLanguage } from '../types/programming-language.type';

export interface LanguageDetector {
  detect(filePath: string): ProgrammingLanguage | null;
}
