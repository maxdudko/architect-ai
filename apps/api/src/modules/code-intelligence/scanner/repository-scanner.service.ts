import { Injectable } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { LanguageDetectorService } from '../languages/language-detector.service';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';
import { ChecksumService } from '../utils/checksum.service';

const IGNORED_FOLDERS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.git',
  'vendor',
  'target',
  'out',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.gif',
  '.svg',
  '.pdf',
  '.zip',
  '.exe',
  '.dll',
]);

export interface RepositoryScanMetrics {
  supportedFileCount: number;
  ignoredFileCount: number;
}

@Injectable()
export class RepositoryScannerService {
  constructor(
    private readonly checksumService: ChecksumService,
    private readonly languageDetector: LanguageDetectorService,
  ) {}

  async scanRepository(
    repositoryRoot: string,
    onCandidate: (candidate: RepositoryFileCandidate) => Promise<void>,
  ): Promise<RepositoryScanMetrics> {
    const stack: string[] = [repositoryRoot];
    let supportedFileCount = 0;
    let ignoredFileCount = 0;

    while (stack.length > 0) {
      const currentPath = stack.pop();
      if (!currentPath) {
        continue;
      }

      const entries = await readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (IGNORED_FOLDERS.has(entry.name)) {
            ignoredFileCount += 1;
            continue;
          }
          stack.push(absolutePath);
          continue;
        }

        if (!entry.isFile()) {
          ignoredFileCount += 1;
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(extension)) {
          ignoredFileCount += 1;
          continue;
        }

        const language = this.languageDetector.detect(absolutePath);
        if (!language) {
          ignoredFileCount += 1;
          continue;
        }

        const fileStats = await stat(absolutePath);
        if (fileStats.size === 0) {
          ignoredFileCount += 1;
          continue;
        }

        const checksum = await this.checksumService.hashFile(absolutePath);
        await onCandidate({
          absolutePath,
          relativePath: path.relative(repositoryRoot, absolutePath),
          language,
          extension,
          size: fileStats.size,
          checksum,
        });
        supportedFileCount += 1;
      }
    }

    return { supportedFileCount, ignoredFileCount };
  }
}
