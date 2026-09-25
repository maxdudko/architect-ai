import { Injectable } from '@nestjs/common';
import {
  CodeSymbolType,
  IndexingRunStatus,
  RepositoryStatus,
  SymbolRelationType,
} from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DEPENDENCY_MAP_CEILING } from '../dependency-map.constants';
import type {
  ArchitectureRevision,
  ArchitectureSnapshot,
  ArchitectureSnapshotNotableSymbol,
} from '../types/architecture-snapshot.type';

/** Upper bound on file paths passed to a notable-symbol lookup. */
const MAX_SYMBOL_LOOKUP_PATHS = 1_000;

/** Symbol types worth surfacing as a module's notable symbols. */
const NOTABLE_SYMBOL_TYPES: CodeSymbolType[] = [
  CodeSymbolType.CLASS,
  CodeSymbolType.INTERFACE,
  CodeSymbolType.FUNCTION,
  CodeSymbolType.ENUM,
  CodeSymbolType.TYPE_ALIAS,
];

/**
 * Reads the indexing result for Dependency Mapping (spec AD-1).
 *
 * Every method takes an explicit `indexingRunId` so the caller resolves the
 * revision once and every part of a view is derived from it (spec AD-4, IR-3).
 */
@Injectable()
export class PrismaArchitectureDataSource {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirms the repository belongs to the requesting workspace before any
   * architecture data is read (spec SEC-2). `CodeSymbol` and `SymbolRelation`
   * carry no workspace column, so this is the only tenancy boundary available
   * and every other read is reached through it (spec AD-3).
   */
  findRepositoryInWorkspace(
    workspaceId: string,
    repositoryId: string,
  ): Promise<{ id: string; status: RepositoryStatus } | null> {
    return this.prisma.repository.findFirst({
      where: { id: repositoryId, workspaceId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  /**
   * The repository's most recent successful revision (spec IR-2), or null when
   * indexing has never completed.
   */
  async findLatestSucceededRevision(
    repositoryId: string,
  ): Promise<ArchitectureRevision | null> {
    const run = await this.prisma.indexingRun.findFirst({
      where: { repositoryId, status: IndexingRunStatus.SUCCEEDED },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        id: true,
        branch: true,
        commitSha: true,
        completedAt: true,
      },
    });

    if (!run) {
      return null;
    }

    return {
      indexingRunId: run.id,
      branch: run.branch,
      commitSha: run.commitSha,
      completedAt: run.completedAt,
    };
  }

  /**
   * Loads everything the derivation needs with three bounded queries plus two
   * aggregate counts. Nothing loaded here grows with module count multiplied
   * by relationship count (spec AD-6).
   */
  async loadSnapshot(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<ArchitectureSnapshot> {
    const [fileRows, moduleSymbols, symbolCounts, nonImportCounts] =
      await Promise.all([
        this.prisma.repositoryFile.findMany({
          where: {
            repositoryId,
            indexingRunId,
            ignored: false,
            binary: false,
            generated: false,
          },
          select: { path: true, language: true, lineCount: true },
          orderBy: { path: 'asc' },
          take: DEPENDENCY_MAP_CEILING.maxFiles + 1,
        }),
        this.prisma.codeSymbol.findMany({
          where: {
            repositoryId,
            indexingRunId,
            type: CodeSymbolType.MODULE,
          },
          select: { id: true, filePath: true },
        }),
        this.prisma.codeSymbol.groupBy({
          by: ['filePath'],
          where: { repositoryId, indexingRunId },
          _count: { _all: true },
        }),
        this.prisma.symbolRelation.groupBy({
          by: ['relationType'],
          where: {
            repositoryId,
            indexingRunId,
            relationType: { not: SymbolRelationType.IMPORTS },
          },
          _count: { _all: true },
        }),
      ]);

    const filesTruncated = fileRows.length > DEPENDENCY_MAP_CEILING.maxFiles;
    const files = filesTruncated
      ? fileRows.slice(0, DEPENDENCY_MAP_CEILING.maxFiles)
      : fileRows;

    const filePathBySymbolId = new Map(
      moduleSymbols.map((symbol) => [symbol.id, symbol.filePath]),
    );

    // Import relationships attach to the file's MODULE symbol, so distinct
    // rows per (symbol, specifier, name) collapse repeated extraction output
    // while keeping the observed target names needed for evidence.
    const importRows = await this.prisma.symbolRelation.findMany({
      where: {
        repositoryId,
        indexingRunId,
        relationType: SymbolRelationType.IMPORTS,
      },
      distinct: ['fromSymbolId', 'targetFilePath', 'targetQualifiedName'],
      select: {
        fromSymbolId: true,
        targetFilePath: true,
        targetQualifiedName: true,
      },
      orderBy: [
        { fromSymbolId: 'asc' },
        { targetFilePath: 'asc' },
        { targetQualifiedName: 'asc' },
      ],
      take: DEPENDENCY_MAP_CEILING.maxImportRelations + 1,
    });

    const importsTruncated =
      importRows.length > DEPENDENCY_MAP_CEILING.maxImportRelations;
    const boundedImportRows = importsTruncated
      ? importRows.slice(0, DEPENDENCY_MAP_CEILING.maxImportRelations)
      : importRows;

    const imports = boundedImportRows.flatMap((row) => {
      const sourceFilePath = filePathBySymbolId.get(row.fromSymbolId);
      if (!sourceFilePath) {
        return [];
      }
      return [
        {
          sourceFilePath,
          observedTarget: row.targetFilePath,
          targetName: row.targetQualifiedName,
          relationType: SymbolRelationType.IMPORTS,
        },
      ];
    });

    return {
      repositoryId,
      indexingRunId,
      files,
      symbolCountsByFile: symbolCounts.map((entry) => ({
        filePath: entry.filePath,
        count: entry._count._all,
      })),
      imports,
      nonImportRelationCounts: nonImportCounts.map((entry) => ({
        relationType: entry.relationType,
        count: entry._count._all,
      })),
      filesTruncated,
      importsTruncated,
    };
  }

  /**
   * Notable symbols for a module, drawn from a bounded slice of its files so
   * the lookup stays proportional to the requested page (spec FR-9).
   */
  async listNotableSymbols(
    repositoryId: string,
    indexingRunId: string,
    filePaths: string[],
    limit: number,
  ): Promise<ArchitectureSnapshotNotableSymbol[]> {
    if (filePaths.length === 0) {
      return [];
    }

    const symbols = await this.prisma.codeSymbol.findMany({
      where: {
        repositoryId,
        indexingRunId,
        filePath: { in: filePaths.slice(0, MAX_SYMBOL_LOOKUP_PATHS) },
        type: { in: NOTABLE_SYMBOL_TYPES },
        exported: true,
      },
      select: {
        name: true,
        qualifiedName: true,
        type: true,
        filePath: true,
        language: true,
        startLine: true,
        endLine: true,
      },
      orderBy: [{ filePath: 'asc' }, { startLine: 'asc' }],
      take: limit,
    });

    return symbols;
  }

  /** Indexed file metadata for a bounded set of paths within one revision. */
  async listFilesByPath(
    repositoryId: string,
    indexingRunId: string,
    filePaths: string[],
  ): Promise<
    Array<{ path: string; language: string; lineCount: number; size: number }>
  > {
    if (filePaths.length === 0) {
      return [];
    }

    return this.prisma.repositoryFile.findMany({
      where: {
        repositoryId,
        indexingRunId,
        path: { in: filePaths },
      },
      select: { path: true, language: true, lineCount: true, size: true },
      orderBy: { path: 'asc' },
    });
  }
}
