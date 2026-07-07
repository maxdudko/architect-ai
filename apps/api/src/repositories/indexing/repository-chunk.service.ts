import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'path';
import { RepositoriesRepository } from '../repositories.repository';

@Injectable()
export class RepositoryChunkService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

  async chunkRepository(data: {
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{ chunkCount: number }> {
    const files = await this.repositoriesRepository.listRepositoryFiles(
      data.repositoryId,
      data.runId,
    );
    const symbols = await this.repositoriesRepository.listCodeSymbols(
      data.repositoryId,
      data.runId,
    );

    let chunkCount = 0;
    for (const file of files) {
      const absolutePath = path.join(data.clonePath, file.path);
      const content = await readFile(absolutePath, 'utf8');
      const fileSymbols = symbols.filter(
        (symbol) => symbol.filePath === file.path,
      );

      if (fileSymbols.length === 0) {
        const chunk = this.createFallbackChunk(content);
        await this.repositoriesRepository.createChunk({
          repositoryId: data.repositoryId,
          indexingRunId: data.runId,
          filePath: file.path,
          language: file.language,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          startLine: 1,
          endLine: Math.max(1, content.split('\n').length),
        });
        chunkCount += 1;
        continue;
      }

      for (const symbol of fileSymbols) {
        const symbolChunk = this.createSymbolChunk(
          content,
          symbol.startLine,
          symbol.endLine,
        );
        await this.repositoriesRepository.createChunk({
          repositoryId: data.repositoryId,
          indexingRunId: data.runId,
          symbolId: symbol.id,
          filePath: file.path,
          language: file.language,
          content: symbolChunk.content,
          tokenCount: symbolChunk.tokenCount,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
        });
        chunkCount += 1;
      }
    }

    return { chunkCount };
  }

  private createFallbackChunk(content: string): {
    content: string;
    tokenCount: number;
  } {
    const truncated = content.split('\n').slice(0, 200).join('\n');
    return {
      content: truncated,
      tokenCount: this.tokenCount(truncated),
    };
  }

  private createSymbolChunk(
    content: string,
    startLine: number,
    endLine: number,
  ): {
    content: string;
    tokenCount: number;
  } {
    const lines = content.split('\n');
    const snippet = lines.slice(startLine - 1, endLine).join('\n');
    return {
      content: snippet,
      tokenCount: this.tokenCount(snippet),
    };
  }

  private tokenCount(content: string): number {
    return content.split(/\s+/).filter(Boolean).length;
  }
}
