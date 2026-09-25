import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ArchitectureOverviewGenerationStatus,
  ArchitectureOverviewGenerationTrigger,
  Prisma,
  RepositoryStatus,
  type ArchitectureOverview,
  type ArchitectureOverviewGenerationRun,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsageService } from '../../../usage/usage.service';
import { UsageMetric } from '@prisma/client';
import { PrismaArchitectureDataSource } from '../dependency-mapping/data/prisma-architecture-data-source';
import type { ArchitectureRevision } from '../dependency-mapping/types/architecture-snapshot.type';
import type {
  ArchitectureOverviewDocumentDto,
  ArchitectureOverviewRunDto,
  SystemOverviewResponseDto,
} from './dto/system-overview.dto';
import { SystemOverviewQueueService } from './queue/system-overview-queue.service';

const PROCESSING_STATUSES: RepositoryStatus[] = [
  RepositoryStatus.PENDING,
  RepositoryStatus.CLONING,
  RepositoryStatus.PARSING,
  RepositoryStatus.CHUNKING,
  RepositoryStatus.EMBEDDING,
];

const NOT_READY_MESSAGE =
  'Architecture overview generation requires a ready repository. Check the repository indexing state.';

const NO_INDEX_MESSAGE =
  'Architecture overview generation is unavailable until this repository finishes indexing. Check the repository indexing state.';

@Injectable()
export class SystemOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: PrismaArchitectureDataSource,
    private readonly queue: SystemOverviewQueueService,
    private readonly usageService: UsageService,
  ) {}

  async getOverview(
    workspaceId: string,
    repositoryId: string,
  ): Promise<SystemOverviewResponseDto> {
    const repository = await this.requireRepository(workspaceId, repositoryId);
    const [latest, overview, run] = await Promise.all([
      this.dataSource.findLatestSucceededRevision(repositoryId),
      this.prisma.architectureOverview.findFirst({
        where: { workspaceId, repositoryId },
      }),
      this.prisma.architectureOverviewGenerationRun.findFirst({
        where: { workspaceId, repositoryId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const indexingAvailable = latest !== null;
    const generationAllowed =
      repository.status === RepositoryStatus.READY && indexingAvailable;

    return {
      repositoryId,
      repositoryStatus: repository.status,
      indexingAvailable,
      generationAllowed,
      rebuildInProgress: PROCESSING_STATUSES.includes(repository.status),
      latestRevision: latest ? toRevisionDto(latest) : null,
      overview: overview ? toDocument(overview, latest) : null,
      run: run ? toRun(run) : null,
    };
  }

  async requestGeneration(
    workspaceId: string,
    repositoryId: string,
    regenerate: boolean,
  ): Promise<ArchitectureOverviewRunDto> {
    const repository = await this.requireRepository(workspaceId, repositoryId);
    if (repository.status !== RepositoryStatus.READY) {
      throw new ConflictException(NOT_READY_MESSAGE);
    }
    const latest =
      await this.dataSource.findLatestSucceededRevision(repositoryId);
    if (!latest) {
      throw new ConflictException(NO_INDEX_MESSAGE);
    }

    const active =
      await this.prisma.architectureOverviewGenerationRun.findFirst({
        where: {
          workspaceId,
          repositoryId,
          status: {
            in: [
              ArchitectureOverviewGenerationStatus.QUEUED,
              ArchitectureOverviewGenerationStatus.RUNNING,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    if (active) {
      return toRun(active);
    }

    await this.usageService.assertWithinLimit(
      workspaceId,
      UsageMetric.GUIDE_GENERATIONS,
    );

    try {
      const run = await this.queue.enqueue({
        workspaceId,
        repositoryId,
        trigger: regenerate
          ? ArchitectureOverviewGenerationTrigger.MANUAL_REGENERATE
          : ArchitectureOverviewGenerationTrigger.MANUAL_GENERATE,
      });
      return toRun(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('queue is unavailable')) {
        throw new ServiceUnavailableException(
          'Architecture overview generation is unavailable. Try again later.',
        );
      }
      throw error;
    }
  }

  private async requireRepository(workspaceId: string, repositoryId: string) {
    const repository = await this.dataSource.findRepositoryInWorkspace(
      workspaceId,
      repositoryId,
    );
    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }
    return repository;
  }
}

function toRevisionDto(revision: ArchitectureRevision) {
  return {
    indexingRunId: revision.indexingRunId,
    branch: revision.branch,
    commitSha: revision.commitSha,
    completedAt: revision.completedAt?.toISOString() ?? null,
  };
}

function toDocument(
  overview: ArchitectureOverview,
  latest: ArchitectureRevision | null,
): ArchitectureOverviewDocumentDto {
  const metadata = readMetadata(overview.metadata);
  return {
    id: overview.id,
    title: overview.title,
    markdown: overview.markdown,
    summary: overview.summary,
    revision: {
      indexingRunId: overview.sourceIndexingRunId,
      branch: overview.sourceBranch,
      commitSha: overview.sourceCommitSha,
      completedAt: null,
    },
    generatedAt: overview.updatedAt.toISOString(),
    generationVersion: overview.generationVersion,
    stale: !latest || latest.indexingRunId !== overview.sourceIndexingRunId,
    citedPaths: metadata.citedPaths,
    partial: metadata.partial,
    modulesAbsent: metadata.modulesAbsent,
  };
}

function toRun(
  run: ArchitectureOverviewGenerationRun,
): ArchitectureOverviewRunDto {
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    completedStep: run.completedStep,
    totalSteps: run.totalSteps,
    error: run.error,
    revision: run.sourceIndexingRunId
      ? {
          indexingRunId: run.sourceIndexingRunId,
          branch: run.sourceBranch,
          commitSha: run.sourceCommitSha,
          completedAt: null,
        }
      : null,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

function readMetadata(value: Prisma.JsonValue): {
  citedPaths: string[];
  partial: boolean;
  modulesAbsent: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { citedPaths: [], partial: false, modulesAbsent: false };
  }
  const record = value as Record<string, Prisma.JsonValue>;
  return {
    citedPaths: Array.isArray(record.citedPaths)
      ? record.citedPaths.filter(
          (path): path is string => typeof path === 'string',
        )
      : [],
    partial: record.partial === true,
    modulesAbsent: record.modulesAbsent === true,
  };
}
