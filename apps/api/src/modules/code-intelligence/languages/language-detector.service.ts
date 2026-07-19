import { Injectable } from '@nestjs/common';
import { LanguageDetector } from '../interfaces/language-detector.interface';
import {
  PROGRAMMING_LANGUAGES,
  ProgrammingLanguage,
} from '../types/programming-language.type';

@Injectable()
export class LanguageDetectorService implements LanguageDetector {
  private readonly extensionMap = new Map<string, ProgrammingLanguage>([
    ['.ts', PROGRAMMING_LANGUAGES.typescript],
    ['.tsx', PROGRAMMING_LANGUAGES.typescript],
    ['.cts', PROGRAMMING_LANGUAGES.typescript],
    ['.mts', PROGRAMMING_LANGUAGES.typescript],
    ['.js', PROGRAMMING_LANGUAGES.javascript],
    ['.jsx', PROGRAMMING_LANGUAGES.javascript],
    ['.cjs', PROGRAMMING_LANGUAGES.javascript],
    ['.mjs', PROGRAMMING_LANGUAGES.javascript],
  ]);

  detect(filePath: string): ProgrammingLanguage | null {
    const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return this.extensionMap.get(extension) ?? null;
  }
}
