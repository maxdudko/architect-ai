import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'path';

@Injectable()
export class IndexingStorageService {
  private readonly baseDir: string;
  private readonly maxCloneBytes: number;
  private readonly staleMinutes: number;

  constructor(private readonly configService: ConfigService) {
    this.baseDir =
      this.configService.get<string>('INDEXING_TMP_DIR') ??
      '/tmp/architect-ai/indexing';
    this.maxCloneBytes = Number(
      this.configService.get<string>('INDEXING_MAX_CLONE_BYTES') ??
        1_000_000_000,
    );
    this.staleMinutes = Number(
      this.configService.get<string>('INDEXING_TMP_STALE_MINUTES') ?? 120,
    );
  }

  getRunDirectory(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  async prepareRunDirectory(runId: string): Promise<string> {
    const directory = this.getRunDirectory(runId);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  async enforceStorageLimit(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const totalSize = await this.getDirectorySize(this.baseDir);
    if (totalSize >= this.maxCloneBytes) {
      throw new Error(
        `Indexing temp storage limit reached (${totalSize} bytes >= ${this.maxCloneBytes} bytes)`,
      );
    }
  }

  async cleanupRunDirectory(runId: string): Promise<void> {
    const directory = this.getRunDirectory(runId);
    await rm(directory, { recursive: true, force: true });
  }

  async cleanupStaleDirectories(): Promise<number> {
    await mkdir(this.baseDir, { recursive: true });
    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const staleThreshold = Date.now() - this.staleMinutes * 60_000;
    let deleted = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(this.baseDir, entry.name);
      const info = await stat(fullPath);
      if (info.mtimeMs < staleThreshold) {
        await rm(fullPath, { recursive: true, force: true });
        deleted += 1;
      }
    }

    return deleted;
  }

  async getWorkingTreeSize(clonePath: string): Promise<number> {
    return this.getDirectorySize(clonePath, new Set(['.git']));
  }

  private async getDirectorySize(
    targetPath: string,
    excludeNames: ReadonlySet<string> = new Set(),
  ): Promise<number> {
    const info = await stat(targetPath);
    if (info.isFile()) {
      return info.size;
    }
    const entries = await readdir(targetPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      if (excludeNames.has(entry.name)) {
        continue;
      }
      const childPath = path.join(targetPath, entry.name);
      total += await this.getDirectorySize(childPath, excludeNames);
    }
    return total;
  }
}
