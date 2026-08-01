import { Injectable, NotFoundException } from '@nestjs/common';
import { IndexingRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IndexedTopologyDataSource } from '../interfaces/indexed-topology-data-source.interface';
import type { IndexedTopologySnapshot } from '../types/topology.type';

@Injectable()
export class PrismaIndexedTopologyDataSource implements IndexedTopologyDataSource {
  constructor(private readonly prisma: PrismaService) {}

  async loadLatest(
    workspaceId: string,
    repositoryId: string,
  ): Promise<IndexedTopologySnapshot> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, workspaceId, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        fullName: true,
        provider: true,
        defaultBranch: true,
        status: true,
        lastIndexedAt: true,
        indexingRuns: {
          where: { status: IndexingRunStatus.SUCCEEDED },
          orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            commitSha: true,
            branch: true,
            completedAt: true,
          },
        },
      },
    });

    const run = repository?.indexingRuns[0];
    if (!repository || !run) {
      throw new NotFoundException(
        'Repository has no successful indexed topology',
      );
    }

    const [files, symbols, relations] = await Promise.all([
      this.prisma.repositoryFile.findMany({
        where: {
          repositoryId,
          indexingRunId: run.id,
          ignored: false,
          binary: false,
          generated: false,
        },
        select: {
          path: true,
          language: true,
          extension: true,
          lineCount: true,
          size: true,
        },
      }),
      this.prisma.codeSymbol.findMany({
        where: { repositoryId, indexingRunId: run.id },
        select: {
          filePath: true,
          name: true,
          qualifiedName: true,
          type: true,
          exported: true,
          isAsync: true,
        },
      }),
      this.prisma.symbolRelation.findMany({
        where: { repositoryId, indexingRunId: run.id },
        select: {
          relationType: true,
          targetFilePath: true,
          targetQualifiedName: true,
          fromSymbol: { select: { filePath: true } },
        },
      }),
    ]);

    return {
      repository: {
        id: repository.id,
        workspaceId: repository.workspaceId,
        name: repository.name,
        fullName: repository.fullName,
        provider: repository.provider,
        defaultBranch: repository.defaultBranch,
        status: repository.status,
        lastIndexedAt: repository.lastIndexedAt,
      },
      run: {
        indexingRunId: run.id,
        commitSha: run.commitSha,
        branch: run.branch,
        completedAt: run.completedAt,
      },
      files,
      symbols: symbols.map((symbol) => ({
        ...symbol,
        type: symbol.type,
      })),
      relations: relations.map((relation) => ({
        fromFilePath: relation.fromSymbol.filePath,
        type: relation.relationType,
        targetFilePath: relation.targetFilePath,
        targetQualifiedName: relation.targetQualifiedName,
      })),
    };
  }
}
