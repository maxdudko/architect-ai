import { Inject, Injectable, Optional } from '@nestjs/common';
import path from 'node:path';
import {
  isSourceLanguage,
  ProgrammingLanguage,
} from '../types/programming-language.type';
import type { LanguagePack, LanguagePackTopologyHints } from './language-pack';
import { LANGUAGE_PACKS } from './tokens';

const SHARED_IGNORE_FOLDERS = [
  '.git',
  'dist',
  'build',
  'coverage',
  'out',
  'target',
] as const;

export interface MergedTopologyHints {
  serviceSuffixes: string[];
  entryFileStems: string[];
  entryBasenames: string[];
  entryPathPatterns: RegExp[];
  highConfidenceEntryStems: string[];
  highConfidenceEntryBasenames: string[];
  techMarkers: LanguagePackTopologyHints['techMarkers'];
}

@Injectable()
export class LanguagePackRegistry {
  private readonly packs: LanguagePack[];

  constructor(
    @Optional()
    @Inject(LANGUAGE_PACKS)
    packs?: LanguagePack[],
  ) {
    this.packs = packs ?? [];
  }

  all(): LanguagePack[] {
    return this.packs;
  }

  getByLanguage(language: string): LanguagePack | undefined {
    return this.packs.find(
      (pack) =>
        pack.id === language ||
        pack.languages.includes(language as ProgrammingLanguage),
    );
  }

  detectLanguage(filePath: string): ProgrammingLanguage | null {
    const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    if (!extension.includes('.')) {
      return null;
    }
    for (const pack of this.packs) {
      const language = pack.extensions[extension];
      if (language) {
        return language;
      }
    }
    return null;
  }

  ignoredFolders(): Set<string> {
    const folders = new Set<string>(SHARED_IGNORE_FOLDERS);
    for (const pack of this.packs) {
      for (const folder of pack.ignoreFolders) {
        folders.add(folder);
      }
    }
    return folders;
  }

  isManifest(relativePath: string): boolean {
    const basename = path.posix.basename(relativePath.replaceAll('\\', '/'));
    const normalized = relativePath.replaceAll('\\', '/');
    for (const pack of this.packs) {
      if (pack.manifestBasenames.includes(basename)) {
        return true;
      }
      if (
        pack.manifestPathPatterns.some((pattern) => pattern.test(normalized))
      ) {
        return true;
      }
    }
    return false;
  }

  topologyHints(): MergedTopologyHints {
    const serviceSuffixes: string[] = [];
    const entryFileStems: string[] = [];
    const entryBasenames: string[] = [];
    const entryPathPatterns: RegExp[] = [];
    const highConfidenceEntryStems: string[] = [];
    const highConfidenceEntryBasenames: string[] = [];
    const techMarkers: LanguagePackTopologyHints['techMarkers'] = [
      {
        pattern: /(^|\/)go\.mod$/,
        name: 'Go modules',
        category: 'runtime',
      },
      {
        pattern: /(^|\/)cargo\.toml$/,
        name: 'Rust Cargo',
        category: 'runtime',
      },
    ];

    for (const pack of this.packs) {
      serviceSuffixes.push(...pack.topologyHints.serviceSuffixes);
      entryFileStems.push(...pack.topologyHints.entryFileStems);
      entryBasenames.push(...pack.topologyHints.entryBasenames);
      entryPathPatterns.push(...pack.topologyHints.entryPathPatterns);
      highConfidenceEntryStems.push(
        ...pack.topologyHints.highConfidenceEntryStems,
      );
      highConfidenceEntryBasenames.push(
        ...pack.topologyHints.highConfidenceEntryBasenames,
      );
      techMarkers.push(...pack.topologyHints.techMarkers);
    }

    return {
      serviceSuffixes: [...new Set(serviceSuffixes)],
      entryFileStems: [...new Set(entryFileStems)],
      entryBasenames: [...new Set(entryBasenames)],
      entryPathPatterns,
      highConfidenceEntryStems: [...new Set(highConfidenceEntryStems)],
      highConfidenceEntryBasenames: [...new Set(highConfidenceEntryBasenames)],
      techMarkers,
    };
  }

  canParse(language: string): boolean {
    return isSourceLanguage(language) && this.getByLanguage(language) != null;
  }
}
