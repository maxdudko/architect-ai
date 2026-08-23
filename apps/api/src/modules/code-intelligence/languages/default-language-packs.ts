import { javascriptLanguagePack } from './javascript.pack';
import type { LanguagePack } from './language-pack';
import { LanguagePackRegistry } from './language-pack.registry';
import { phpLanguagePack } from './php.pack';
import { pythonLanguagePack } from './python.pack';

export function loadDefaultLanguagePacks(): LanguagePack[] {
  return [javascriptLanguagePack, pythonLanguagePack, phpLanguagePack];
}

export function createDefaultLanguagePackRegistry(): LanguagePackRegistry {
  return new LanguagePackRegistry(loadDefaultLanguagePacks());
}
