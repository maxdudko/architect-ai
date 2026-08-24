import { Injectable } from '@nestjs/common';
import { IndexingRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import { ChunkForIndexing } from '../types/chunk-for-indexing.type';
import { SemanticChunkRecord } from '../types/semantic-chunk-record.type';

type ChunkMetadata = {
  symbolType?: string;
  qualifiedName?: string;
  language?: string;
  symbolName?: string;
};

@Injectable()
export class PrismaChunkDataSource implements ChunkDataSource {
  constructor(private readonly prisma: PrismaService) {}

  async listChunksForIndexing(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<ChunkForIndexing[]> {
    const chunks = await this.prisma.chunk.findMany({
      where: {
        repositoryId,
        indexingRunId,
      },
      include: {
        repository: {
          select: {
            workspaceId: true,
          },
        },
        indexingRun: {
          select: {
            branch: true,
          },
        },
        symbol: {
          select: {
            name: true,
            qualifiedName: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return chunks.map((chunk) => {
      const metadata = this.readMetadata(chunk.metadata);
      return {
        id: chunk.id,
        content: chunk.content,
        workspaceId: chunk.repository.workspaceId,
        repositoryId: chunk.repositoryId,
        indexingRunId: chunk.indexingRunId,
        fileId: chunk.fileId,
        symbolId: chunk.symbolId,
        filePath: chunk.filePath,
        symbolName: chunk.symbol?.name ?? metadata.symbolName ?? null,
        qualifiedName:
          chunk.symbol?.qualifiedName ?? metadata.qualifiedName ?? null,
        symbolType: chunk.symbol?.type ?? metadata.symbolType ?? null,
        language: chunk.language ?? metadata.language ?? null,
        branch: chunk.indexingRun.branch ?? 'main',
        createdAt: chunk.createdAt,
      };
    });
  }

  async getChunksByIds(chunkIds: string[]): Promise<SemanticChunkRecord[]> {
    if (chunkIds.length === 0) {
      return [];
    }

    const chunks = await this.prisma.chunk.findMany({
      where: {
        id: { in: chunkIds },
      },
      include: {
        symbol: {
          select: {
            name: true,
            qualifiedName: true,
            type: true,
          },
        },
      },
    });

    return chunks.map((chunk) => {
      const metadata = this.readMetadata(chunk.metadata);
      return {
        id: chunk.id,
        repositoryId: chunk.repositoryId,
        fileId: chunk.fileId,
        symbolId: chunk.symbolId,
        filePath: chunk.filePath,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language ?? metadata.language ?? null,
        symbolName: chunk.symbol?.name ?? metadata.symbolName ?? null,
        qualifiedName:
          chunk.symbol?.qualifiedName ?? metadata.qualifiedName ?? null,
        symbolType: chunk.symbol?.type ?? metadata.symbolType ?? null,
        createdAt: chunk.createdAt,
      };
    });
  }

  async listLiveIndexingRunIds(
    workspaceId: string,
    repositoryIds?: string[],
  ): Promise<string[]> {
    const runs = await this.prisma.indexingRun.findMany({
      where: {
        status: IndexingRunStatus.SUCCEEDED,
        repository: {
          workspaceId,
          deletedAt: null,
          ...(repositoryIds && repositoryIds.length > 0
            ? { id: { in: repositoryIds } }
            : {}),
        },
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        id: true,
        repositoryId: true,
      },
    });

    const seenRepositories = new Set<string>();
    const liveRunIds: string[] = [];
    for (const run of runs) {
      if (seenRepositories.has(run.repositoryId)) {
        continue;
      }
      seenRepositories.add(run.repositoryId);
      liveRunIds.push(run.id);
    }
    return liveRunIds;
  }

  async listVectorizedChunksByIndexingRun(): Promise<
    Array<{ indexingRunId: string; chunkIds: string[] }>
  > {
    const chunks = await this.prisma.chunk.findMany({
      where: {
        vectorId: { not: null },
      },
      select: {
        id: true,
        indexingRunId: true,
      },
    });

    const chunkIdsByRun = new Map<string, string[]>();
    for (const chunk of chunks) {
      const existing = chunkIdsByRun.get(chunk.indexingRunId) ?? [];
      existing.push(chunk.id);
      chunkIdsByRun.set(chunk.indexingRunId, existing);
    }

    return [...chunkIdsByRun.entries()].map(([indexingRunId, chunkIds]) => ({
      indexingRunId,
      chunkIds,
    }));
  }

  private readMetadata(value: Prisma.JsonValue | null): ChunkMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return {
      symbolType:
        typeof value.symbolType === 'string' ? value.symbolType : undefined,
      qualifiedName:
        typeof value.qualifiedName === 'string'
          ? value.qualifiedName
          : undefined,
      language: typeof value.language === 'string' ? value.language : undefined,
      symbolName:
        typeof value.symbolName === 'string' ? value.symbolName : undefined,
    };
  }
}
