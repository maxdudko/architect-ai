import { Injectable } from '@nestjs/common';
import {
  CodeSymbol,
  CodeSymbolType,
  IndexingRun,
  IndexingRunStatus,
  IndexingTrigger,
  Prisma,
  Repository,
  RepositoryFile,
  RepositoryProvider,
  RepositoryStatus,
  Chunk,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepositoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    workspaceId: string,
    data: {
      provider: RepositoryProvider;
      externalId: string;
      owner: string;
      name: string;
      fullName: string;
      defaultBranch: string;
    },
  ): Promise<Repository> {
    return this.prisma.repository.create({
      data: {
        workspaceId,
        provider: data.provider,
        externalId: data.externalId,
        owner: data.owner,
        name: data.name,
        fullName: data.fullName,
        defaultBranch: data.defaultBranch,
        status: RepositoryStatus.PENDING,
      },
    });
  }

  findById(
    workspaceId: string,
    repositoryId: string,
  ): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
    });
  }

  findByProviderAndExternalId(
    provider: RepositoryProvider,
    externalId: string,
  ): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: {
        provider,
        externalId,
        deletedAt: null,
      },
    });
  }

  listByWorkspace(workspaceId: string): Promise<Repository[]> {
    return this.prisma.repository.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listExternalIdsByProvider(
    provider: RepositoryProvider,
  ): Promise<string[]> {
    const repositories = await this.prisma.repository.findMany({
      where: {
        provider,
        deletedAt: null,
      },
      select: {
        externalId: true,
      },
    });
    return repositories.map((repository) => repository.externalId);
  }

  async update(
    workspaceId: string,
    repositoryId: string,
    data: Prisma.RepositoryUpdateInput,
  ): Promise<Repository | null> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(workspaceId, repositoryId);
  }

  async softDelete(workspaceId: string, repositoryId: string): Promise<number> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return result.count;
  }

  async updateStatus(
    workspaceId: string,
    repositoryId: string,
    params: {
      status: RepositoryStatus;
      indexingError?: string | null;
      lastIndexedAt?: Date | null;
    },
  ): Promise<Repository | null> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      data: {
        status: params.status,
        indexingError: params.indexingError,
        lastIndexedAt: params.lastIndexedAt,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(workspaceId, repositoryId);
  }

  createIndexingRun(data: {
    repositoryId: string;
    trigger: IndexingTrigger;
    status: IndexingRunStatus;
    branch?: string | null;
  }): Promise<IndexingRun> {
    return this.prisma.indexingRun.create({
      data: {
        repositoryId: data.repositoryId,
        trigger: data.trigger,
        status: data.status,
        branch: data.branch ?? null,
      },
    });
  }

  getIndexingRunById(runId: string): Promise<IndexingRun | null> {
    return this.prisma.indexingRun.findUnique({
      where: { id: runId },
    });
  }

  updateIndexingRun(
    runId: string,
    data: {
      branch?: string;
      commitSha?: string;
      clonePath?: string;
      supportedFileCount?: number;
      ignoredFileCount?: number;
      symbolCount?: number;
      chunkCount?: number;
      embeddingCount?: number;
      status?: IndexingRunStatus;
      error?: string;
      completedAt?: Date;
    },
  ): Promise<IndexingRun> {
    return this.prisma.indexingRun.update({
      where: { id: runId },
      data,
    });
  }

  async deleteArtifactsForRepository(repositoryId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.chunk.deleteMany({
        where: { repositoryId },
      }),
      this.prisma.codeSymbol.deleteMany({
        where: { repositoryId },
      }),
      this.prisma.repositoryFile.deleteMany({
        where: { repositoryId },
      }),
    ]);
  }

  upsertRepositoryFile(params: {
    repositoryId: string;
    indexingRunId: string;
    path: string;
    language: string;
    contentHash: string;
  }): Promise<RepositoryFile> {
    return this.prisma.repositoryFile.upsert({
      where: {
        repositoryId_indexingRunId_path: {
          repositoryId: params.repositoryId,
          indexingRunId: params.indexingRunId,
          path: params.path,
        },
      },
      create: {
        repositoryId: params.repositoryId,
        indexingRunId: params.indexingRunId,
        path: params.path,
        language: params.language,
        contentHash: params.contentHash,
      },
      update: {
        language: params.language,
        contentHash: params.contentHash,
      },
    });
  }

  async createCodeSymbols(
    repositoryId: string,
    indexingRunId: string,
    filePath: string,
    symbols: Array<{
      type: CodeSymbolType;
      name: string;
      startLine: number;
      endLine: number;
    }>,
  ): Promise<void> {
    const file = await this.prisma.repositoryFile.findFirst({
      where: {
        repositoryId,
        indexingRunId,
        path: filePath,
      },
      select: { id: true },
    });

    await this.prisma.codeSymbol.createMany({
      data: symbols.map((symbol) => ({
        repositoryId,
        indexingRunId,
        fileId: file?.id ?? null,
        filePath,
        type: symbol.type,
        name: symbol.name,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
      })),
    });
  }

  listRepositoryFiles(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<Array<RepositoryFile>> {
    return this.prisma.repositoryFile.findMany({
      where: {
        repositoryId,
        indexingRunId,
      },
      orderBy: { path: 'asc' },
    });
  }

  listCodeSymbols(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<Array<CodeSymbol>> {
    return this.prisma.codeSymbol.findMany({
      where: {
        repositoryId,
        indexingRunId,
      },
      orderBy: [{ filePath: 'asc' }, { startLine: 'asc' }],
    });
  }

  createChunk(params: {
    repositoryId: string;
    indexingRunId: string;
    filePath: string;
    content: string;
    tokenCount: number;
    language?: string;
    startLine?: number;
    endLine?: number;
    symbolId?: string;
  }): Promise<Chunk> {
    return this.prisma.chunk.create({
      data: {
        repositoryId: params.repositoryId,
        indexingRunId: params.indexingRunId,
        filePath: params.filePath,
        content: params.content,
        tokenCount: params.tokenCount,
        language: params.language,
        startLine: params.startLine,
        endLine: params.endLine,
        symbolId: params.symbolId,
      },
    });
  }

  listChunks(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<Array<Chunk>> {
    return this.prisma.chunk.findMany({
      where: {
        repositoryId,
        indexingRunId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateChunkVectorIds(
    repositoryId: string,
    indexingRunId: string,
    mappings: Array<{ chunkId: string; vectorId: string }>,
    embeddingModel: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      mappings.map((mapping) =>
        this.prisma.chunk.updateMany({
          where: {
            id: mapping.chunkId,
            repositoryId,
            indexingRunId,
          },
          data: {
            vectorId: mapping.vectorId,
            embeddingModel,
          },
        }),
      ),
    );
  }
}
