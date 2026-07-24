import { Inject, Injectable } from '@nestjs/common';
import type { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import { CHUNK_DATA_SOURCE } from '../interfaces/tokens';
import type { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';
import type {
  RetrievedChunk,
  RetrievedContext,
  RetrievedFile,
  RetrievedSymbol,
} from '../types/retrieved-context.type';

@Injectable()
export class ContextAssemblerService {
  constructor(
    @Inject(CHUNK_DATA_SOURCE)
    private readonly chunkDataSource: ChunkDataSource,
  ) {}

  async assemble(
    candidates: ScoredChunkCandidate[],
  ): Promise<RetrievedContext> {
    if (candidates.length === 0) {
      return {
        chunks: [],
        symbols: [],
        files: [],
        references: [],
      };
    }

    const scoreByChunkId = new Map(
      candidates.map((candidate) => [candidate.chunkId, candidate.score]),
    );
    const records = await this.chunkDataSource.getChunksByIds(
      candidates.map((candidate) => candidate.chunkId),
    );
    const recordById = new Map(records.map((record) => [record.id, record]));

    const orderedRecords = candidates
      .map((candidate) => recordById.get(candidate.chunkId))
      .filter((record): record is NonNullable<typeof record> =>
        Boolean(record),
      );

    const chunks: RetrievedChunk[] = [];
    const seenContent = new Set<string>();
    const symbols = new Map<string, RetrievedSymbol>();
    const files = new Map<string, RetrievedFile>();

    const sortedForStructure = [...orderedRecords].sort((left, right) => {
      const repoCompare = left.repositoryId.localeCompare(right.repositoryId);
      if (repoCompare !== 0) {
        return repoCompare;
      }
      const fileCompare = left.filePath.localeCompare(right.filePath);
      if (fileCompare !== 0) {
        return fileCompare;
      }
      return (left.qualifiedName ?? '').localeCompare(
        right.qualifiedName ?? '',
      );
    });

    for (const record of sortedForStructure) {
      const contentKey = `${record.repositoryId}:${record.filePath}:${record.startLine}:${record.endLine}:${record.content}`;
      if (seenContent.has(contentKey)) {
        continue;
      }
      seenContent.add(contentKey);

      const score = scoreByChunkId.get(record.id) ?? 0;
      chunks.push({
        id: record.id,
        repositoryId: record.repositoryId,
        fileId: record.fileId,
        symbolId: record.symbolId,
        filePath: record.filePath,
        content: record.content,
        tokenCount: record.tokenCount,
        startLine: record.startLine,
        endLine: record.endLine,
        language: record.language,
        symbolName: record.symbolName,
        qualifiedName: record.qualifiedName,
        symbolType: record.symbolType,
        score,
      });

      if (record.symbolId) {
        symbols.set(record.symbolId, {
          id: record.symbolId,
          name: record.symbolName,
          qualifiedName: record.qualifiedName,
          type: record.symbolType,
          filePath: record.filePath,
          repositoryId: record.repositoryId,
        });
      }

      const fileKey = `${record.repositoryId}:${record.filePath}`;
      if (!files.has(fileKey)) {
        files.set(fileKey, {
          id: record.fileId,
          path: record.filePath,
          repositoryId: record.repositoryId,
          language: record.language,
        });
      }
    }

    return {
      chunks,
      symbols: [...symbols.values()],
      files: [...files.values()],
      references: chunks.map((chunk) => ({
        chunkId: chunk.id,
        repositoryId: chunk.repositoryId,
        filePath: chunk.filePath,
        symbolName: chunk.symbolName,
        qualifiedName: chunk.qualifiedName,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        score: chunk.score,
      })),
    };
  }
}
