import { Injectable } from '@nestjs/common';
import {
  CodeSymbolType,
  Prisma,
  RepositoryFile,
  SymbolRelationType,
} from '@prisma/client';
import { RepositoriesRepository } from '../../../repositories/repositories.repository';

@Injectable()
export class CodeIntelligenceStorageService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
  ) {}

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
    return this.repositoriesRepository.upsertRepositoryFile(params);
  }

  pruneStaleRepositoryFiles(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<{ count: number }> {
    return this.repositoriesRepository.pruneStaleRepositoryFiles(
      repositoryId,
      indexingRunId,
    );
  }

  createCodeSymbols(
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
    return this.repositoriesRepository.createCodeSymbols(
      repositoryId,
      indexingRunId,
      fileId,
      filePath,
      symbols,
    );
  }

  createSymbolRelations(params: {
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
    return this.repositoriesRepository.createSymbolRelations(params);
  }

  listCodeSymbols(repositoryId: string, indexingRunId: string) {
    return this.repositoriesRepository.listCodeSymbols(
      repositoryId,
      indexingRunId,
    );
  }

  listRepositoryFiles(repositoryId: string, indexingRunId: string) {
    return this.repositoriesRepository.listRepositoryFiles(
      repositoryId,
      indexingRunId,
    );
  }

  createChunk(params: {
    repositoryId: string;
    indexingRunId: string;
    fileId: string;
    symbolId: string;
    filePath: string;
    content: string;
    tokenCount: number;
    language: string;
    startLine: number;
    endLine: number;
    metadata: Prisma.JsonObject;
  }) {
    return this.repositoriesRepository.createChunk(params);
  }
}
