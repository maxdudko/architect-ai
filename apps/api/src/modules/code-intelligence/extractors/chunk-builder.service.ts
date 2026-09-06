import { Injectable } from '@nestjs/common';
import { CodeSymbolType, Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CodeIntelligenceStorageService } from '../storage/code-intelligence-storage.service';
import { TextMetricsService } from '../utils/text-metrics.service';

@Injectable()
export class ChunkBuilderService {
  constructor(
    private readonly storageService: CodeIntelligenceStorageService,
    private readonly textMetricsService: TextMetricsService,
  ) {}

  async buildChunks(params: {
    repositoryId: string;
    indexingRunId: string;
    clonePath: string;
  }): Promise<{ chunkCount: number; tokenCount: number }> {
    await this.storageService.deleteChunksForIndexingRun(params.indexingRunId);

    const files = await this.storageService.listRepositoryFiles(
      params.repositoryId,
      params.indexingRunId,
    );
    const symbols = await this.storageService.listCodeSymbols(
      params.repositoryId,
      params.indexingRunId,
    );

    let chunkCount = 0;
    let tokenCount = 0;

    for (const file of files) {
      if (file.generated) {
        continue;
      }
      const source = await readFile(
        path.join(params.clonePath, file.path),
        'utf8',
      );
      const lines = source.split('\n');
      const fileSymbols = symbols.filter((symbol) => symbol.fileId === file.id);
      const semanticSymbols = fileSymbols.filter(
        (symbol) => symbol.type !== CodeSymbolType.MODULE,
      );
      const chunkSymbols =
        semanticSymbols.length > 0 ? semanticSymbols : fileSymbols;

      for (const symbol of chunkSymbols) {
        const content = lines
          .slice(
            Math.max(0, symbol.startLine - 1),
            Math.min(lines.length, symbol.endLine),
          )
          .join('\n');

        const metadata: Prisma.JsonObject = {
          symbolType: symbol.type,
          qualifiedName: symbol.qualifiedName,
          language: symbol.language,
        };

        const chunkTokenCount = this.textMetricsService.tokenCount(content);
        await this.storageService.createChunk({
          repositoryId: params.repositoryId,
          indexingRunId: params.indexingRunId,
          fileId: file.id,
          symbolId: symbol.id,
          filePath: file.path,
          language: symbol.language,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          content,
          tokenCount: chunkTokenCount,
          metadata,
        });
        chunkCount += 1;
        tokenCount += chunkTokenCount;
      }
    }

    return { chunkCount, tokenCount };
  }
}
