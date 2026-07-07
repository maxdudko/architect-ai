import { Injectable } from '@nestjs/common';
import { CodeSymbolType } from '@prisma/client';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'path';
import { RepositoriesRepository } from '../repositories.repository';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.rs',
]);

const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
]);

interface ParsedSymbol {
  type: CodeSymbolType;
  name: string;
  startLine: number;
  endLine: number;
}

@Injectable()
export class RepositoryParseService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  async parseRepository(data: {
    workspaceId: string;
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{
    supportedFileCount: number;
    ignoredFileCount: number;
    symbolCount: number;
  }> {
    const files = await this.discoverFiles(data.clonePath);
    const supportedFiles = files.filter((filePath) =>
      SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
    );

    let symbolCount = 0;
    for (const filePath of supportedFiles) {
      const content = await readFile(filePath, 'utf8');
      const relativePath = path.relative(data.clonePath, filePath);
      const symbols = this.extractSymbols(content);
      symbolCount += symbols.length;

      await this.repositoriesRepository.upsertRepositoryFile({
        repositoryId: data.repositoryId,
        indexingRunId: data.runId,
        path: relativePath,
        language: path.extname(filePath).slice(1).toLowerCase() || 'text',
        contentHash: this.hashContent(content),
      });

      if (symbols.length > 0) {
        await this.repositoriesRepository.createCodeSymbols(
          data.repositoryId,
          data.runId,
          relativePath,
          symbols,
        );
      }
    }

    return {
      supportedFileCount: supportedFiles.length,
      ignoredFileCount: files.length - supportedFiles.length,
      symbolCount,
    };
  }

  private extractSymbols(content: string): ParsedSymbol[] {
    const lines = content.split('\n');
    const symbols: ParsedSymbol[] = [];
    const patterns: Array<{ type: ParsedSymbol['type']; regex: RegExp }> = [
      { type: 'CLASS', regex: /^\s*class\s+([A-Za-z0-9_]+)/ },
      { type: 'INTERFACE', regex: /^\s*interface\s+([A-Za-z0-9_]+)/ },
      { type: 'FUNCTION', regex: /^\s*function\s+([A-Za-z0-9_]+)/ },
      {
        type: 'METHOD',
        regex: /^\s*(?:public|private|protected)?\s*([A-Za-z0-9_]+)\s*\(/,
      },
    ];

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match?.[1]) {
          symbols.push({
            type: pattern.type,
            name: match[1],
            startLine: index + 1,
            endLine: Math.min(index + 50, lines.length),
          });
          break;
        }
      }
    });

    return symbols;
  }

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const out: string[] = [];
    const stack = [rootPath];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_SEGMENTS.has(entry.name)) {
          continue;
        }
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const fileInfo = await stat(fullPath);
        if (fileInfo.size > 512_000) {
          continue;
        }
        out.push(fullPath);
      }
    }

    return out;
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i += 1) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }
}
