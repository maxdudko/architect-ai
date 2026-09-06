import { Injectable, Logger } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { IndexableFilesLimitExceededError } from '../errors/indexable-files-limit-exceeded.error';
import { isUnparseableFileError } from '../errors/unparseable-file.error';
import { LanguageDetectorService } from '../languages/language-detector.service';
import { LanguagePackRegistry } from '../languages/language-pack.registry';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';
import { ChecksumService } from '../utils/checksum.service';
import {
  BINARY_EXTENSIONS,
  classifyIndexableFile,
} from './indexable-file.policy';

export interface RepositoryScanMetrics {
  supportedFileCount: number;
  ignoredFileCount: number;
}

export interface RepositoryScanOptions {
  maxFileSizeBytes?: number | null;
  maxIndexableFiles?: number | null;
}

interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  language: RepositoryFileCandidate['language'];
  extension: string;
  size: number;
}

@Injectable()
export class RepositoryScannerService {
  private readonly logger = new Logger(RepositoryScannerService.name);

  constructor(
    private readonly checksumService: ChecksumService,
    private readonly languageDetector: LanguageDetectorService,
    private readonly languagePacks: LanguagePackRegistry,
  ) {}

  async scanRepository(
    repositoryRoot: string,
    onCandidate: (candidate: RepositoryFileCandidate) => Promise<void>,
    options: RepositoryScanOptions = {},
  ): Promise<RepositoryScanMetrics> {
    const discovery = await this.discoverIndexableFiles(
      repositoryRoot,
      options,
    );
    let supportedFileCount = 0;
    let ignoredFileCount = discovery.ignoredFileCount;

    for (const discovered of discovery.candidates) {
      let checksum: string;
      try {
        checksum = await this.checksumService.hashFile(discovered.absolutePath);
      } catch (error) {
        this.logger.warn(
          `Skipping unhashable file ${discovered.absolutePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        ignoredFileCount += 1;
        continue;
      }

      try {
        await onCandidate({
          ...discovered,
          checksum,
        });
        supportedFileCount += 1;
      } catch (error) {
        if (isUnparseableFileError(error)) {
          this.logger.warn(error.message);
          ignoredFileCount += 1;
          continue;
        }
        throw error;
      }
    }

    return { supportedFileCount, ignoredFileCount };
  }

  async discoverIndexableFiles(
    repositoryRoot: string,
    options: RepositoryScanOptions = {},
  ): Promise<{
    candidates: DiscoveredFile[];
    ignoredFileCount: number;
  }> {
    const stack: string[] = [repositoryRoot];
    const candidates: DiscoveredFile[] = [];
    let ignoredFileCount = 0;
    const ignoredFolders = this.languagePacks.ignoredFolders();
    const maxIndexableFiles = options.maxIndexableFiles ?? null;

    while (stack.length > 0) {
      const currentPath = stack.pop();
      if (!currentPath) {
        continue;
      }

      let entries;
      try {
        entries = await readdir(currentPath, { withFileTypes: true });
      } catch (error) {
        this.logger.warn(
          `Skipping unreadable directory ${currentPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        ignoredFileCount += 1;
        continue;
      }

      for (const entry of entries) {
        const absolutePath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (ignoredFolders.has(entry.name)) {
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

        const relativePath = path.relative(repositoryRoot, absolutePath);
        const extension = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(extension)) {
          ignoredFileCount += 1;
          continue;
        }

        const isManifest = this.languagePacks.isManifest(relativePath);
        const language = isManifest
          ? PROGRAMMING_LANGUAGES.config
          : this.languageDetector.detect(absolutePath);
        if (!language) {
          ignoredFileCount += 1;
          continue;
        }

        let fileStats;
        try {
          fileStats = await stat(absolutePath);
        } catch (error) {
          this.logger.warn(
            `Skipping unreadable file ${absolutePath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          ignoredFileCount += 1;
          continue;
        }

        const classification = classifyIndexableFile({
          relativePath,
          size: fileStats.size,
          ignoredFolders,
          isManifest: (filePath) => this.languagePacks.isManifest(filePath),
          detectLanguage: (filePath) => this.languageDetector.detect(filePath),
          maxFileSizeBytes: options.maxFileSizeBytes,
        });

        if (classification !== 'indexable') {
          ignoredFileCount += 1;
          continue;
        }

        if (
          maxIndexableFiles != null &&
          candidates.length + 1 > maxIndexableFiles
        ) {
          throw new IndexableFilesLimitExceededError(
            candidates.length + 1,
            maxIndexableFiles,
          );
        }

        candidates.push({
          absolutePath,
          relativePath,
          language,
          extension: extension || path.extname(entry.name),
          size: fileStats.size,
        });
      }
    }

    return { candidates, ignoredFileCount };
  }
}
