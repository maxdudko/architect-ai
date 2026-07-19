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
  SymbolRelationType,
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

  findAnyByProviderAndExternalId(
    provider: RepositoryProvider,
    externalId: string,
  ): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: {
        provider,
        externalId,
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

  async restore(
    workspaceId: string,
    repositoryId: string,
    data: {
      owner: string;
      name: string;
      fullName: string;
      defaultBranch: string;
      status: RepositoryStatus;
      lastIndexedAt?: Date | null;
      indexingError?: string | null;
    },
  ): Promise<Repository | null> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: {
          not: null,
        },
      },
      data: {
        owner: data.owner,
        name: data.name,
        fullName: data.fullName,
        defaultBranch: data.defaultBranch,
        status: data.status,
        lastIndexedAt: data.lastIndexedAt,
        indexingError: data.indexingError,
        deletedAt: null,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(workspaceId, repositoryId);
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
      processingDurationMs?: number;
      status?: IndexingRunStatus;
      error?: string;
      errors?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
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
      this.prisma.symbolRelation.deleteMany({
        where: { repositoryId },
      }),
      this.prisma.codeSymbol.deleteMany({
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
    size: number;
    lineCount: number;
    extension: string;
    generated: boolean;
    ignored: boolean;
    binary: boolean;
  }): Promise<RepositoryFile> {
    return this.prisma.repositoryFile.upsert({
      where: {
        repositoryId_path: {
          repositoryId: params.repositoryId,
          path: params.path,
        },
      },
      create: {
        repositoryId: params.repositoryId,
        indexingRunId: params.indexingRunId,
        path: params.path,
        language: params.language,
        contentHash: params.contentHash,
        size: params.size,
        lineCount: params.lineCount,
        extension: params.extension,
        generated: params.generated,
        ignored: params.ignored,
        binary: params.binary,
      },
      update: {
        indexingRunId: params.indexingRunId,
        language: params.language,
        contentHash: params.contentHash,
        size: params.size,
        lineCount: params.lineCount,
        extension: params.extension,
        generated: params.generated,
        ignored: params.ignored,
        binary: params.binary,
      },
    });
  }

  pruneStaleRepositoryFiles(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<{ count: number }> {
    return this.prisma.repositoryFile.deleteMany({
      where: {
        repositoryId,
        NOT: { indexingRunId },
      },
    });
  }

  async createCodeSymbols(
    repositoryId: string,
    indexingRunId: string,
    fileId: string,
    filePath: string,
    symbols: Array<{
      localId: string;
      type: CodeSymbolType;
      name: string;
      qualifiedName: string;
      language: string;
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
      exported: boolean;
      isAsync: boolean;
      isStatic: boolean;
      visibility: string;
      parentLocalId: string | null;
    }>,
  ): Promise<Map<string, string>> {
    const createdSymbolMap = new Map<string, string>();

    for (const symbol of symbols) {
      const parentSymbolId = symbol.parentLocalId
        ? (createdSymbolMap.get(symbol.parentLocalId) ?? null)
        : null;
      const created = await this.prisma.codeSymbol.create({
        data: {
          repositoryId,
          indexingRunId,
          fileId,
          filePath,
          type: symbol.type,
          name: symbol.name,
          qualifiedName: symbol.qualifiedName,
          language: symbol.language,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          startColumn: symbol.startColumn,
          endColumn: symbol.endColumn,
          exported: symbol.exported,
          isAsync: symbol.isAsync,
          isStatic: symbol.isStatic,
          visibility: symbol.visibility,
          parentSymbolId,
        },
      });
      createdSymbolMap.set(symbol.localId, created.id);
    }

    return createdSymbolMap;
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

  listCurrentRepositoryFiles(
    repositoryId: string,
    options?: { pathPrefix?: string },
  ): Promise<Array<RepositoryFile>> {
    return this.prisma.repositoryFile.findMany({
      where: {
        repositoryId,
        ...(options?.pathPrefix
          ? { path: { startsWith: options.pathPrefix } }
          : {}),
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

  listCurrentCodeSymbols(
    repositoryId: string,
    options?: { filePath?: string; type?: CodeSymbolType },
  ): Promise<Array<CodeSymbol>> {
    return this.prisma.codeSymbol.findMany({
      where: {
        repositoryId,
        ...(options?.filePath ? { filePath: options.filePath } : {}),
        ...(options?.type ? { type: options.type } : {}),
      },
      orderBy: [{ filePath: 'asc' }, { startLine: 'asc' }],
    });
  }

  async createSymbolRelations(params: {
    repositoryId: string;
    indexingRunId: string;
    relations: Array<{
      fromSymbolId: string;
      toSymbolId?: string;
      relationType: SymbolRelationType;
      targetQualifiedName?: string;
      targetFilePath?: string;
    }>;
  }): Promise<void> {
    if (params.relations.length === 0) {
      return;
    }

    await this.prisma.symbolRelation.createMany({
      data: params.relations.map((relation) => ({
        repositoryId: params.repositoryId,
        indexingRunId: params.indexingRunId,
        fromSymbolId: relation.fromSymbolId,
        toSymbolId: relation.toSymbolId,
        relationType: relation.relationType,
        targetQualifiedName: relation.targetQualifiedName,
        targetFilePath: relation.targetFilePath,
      })),
    });
  }

  createChunk(params: {
    repositoryId: string;
    indexingRunId: string;
    fileId: string;
    filePath: string;
    content: string;
    tokenCount: number;
    metadata?: Prisma.JsonObject;
    language?: string;
    startLine?: number;
    endLine?: number;
    symbolId?: string;
  }): Promise<Chunk> {
    return this.prisma.chunk.create({
      data: {
        repositoryId: params.repositoryId,
        indexingRunId: params.indexingRunId,
        fileId: params.fileId,
        filePath: params.filePath,
        content: params.content,
        tokenCount: params.tokenCount,
        metadata: params.metadata,
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
