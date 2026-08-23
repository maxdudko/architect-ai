import { Injectable } from '@nestjs/common';
import { LanguageDetector } from '../interfaces/language-detector.interface';
import { LanguagePackRegistry } from './language-pack.registry';
import { ProgrammingLanguage } from '../types/programming-language.type';

@Injectable()
export class LanguageDetectorService implements LanguageDetector {
  constructor(private readonly languagePacks: LanguagePackRegistry) {}

  detect(filePath: string): ProgrammingLanguage | null {
    return this.languagePacks.detectLanguage(filePath);
  }
}
