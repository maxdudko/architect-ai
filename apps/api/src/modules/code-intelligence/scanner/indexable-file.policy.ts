import path from 'node:path';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';

export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.gif',
  '.svg',
  '.pdf',
  '.zip',
  '.exe',
  '.dll',
]);

export type IndexableFileClassification = 'indexable' | 'ignored' | 'oversized';

export function pathHasIgnoredFolder(
  relativePath: string,
  ignoredFolders: ReadonlySet<string>,
): boolean {
  const parts = relativePath.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts.some((part) => ignoredFolders.has(part));
}

export function fileExtension(filePath: string): string {
  return path.posix.extname(filePath.replaceAll('\\', '/')).toLowerCase();
}

export function classifyIndexableFile(params: {
  relativePath: string;
  size: number;
  ignoredFolders: ReadonlySet<string>;
  isManifest: (relativePath: string) => boolean;
  detectLanguage: (filePath: string) => string | null;
  maxFileSizeBytes?: number | null;
}): IndexableFileClassification {
  if (pathHasIgnoredFolder(params.relativePath, params.ignoredFolders)) {
    return 'ignored';
  }

  const extension = fileExtension(params.relativePath);
  if (BINARY_EXTENSIONS.has(extension)) {
    return 'ignored';
  }

  const language = params.isManifest(params.relativePath)
    ? PROGRAMMING_LANGUAGES.config
    : params.detectLanguage(params.relativePath);
  if (!language) {
    return 'ignored';
  }

  if (params.size === 0) {
    return 'ignored';
  }

  if (
    params.maxFileSizeBytes != null &&
    params.size > params.maxFileSizeBytes
  ) {
    return 'oversized';
  }

  return 'indexable';
}
