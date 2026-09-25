import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArchitectureOverviewGenerationStatus, Prisma } from '@prisma/client';
import { createDefaultLanguagePackRegistry } from '../../code-intelligence/languages/default-language-packs';
import type { LlmProvider } from '../../llm/interfaces/llm-provider.interface';
import { RetrievalService } from '../../retrieval/retrieval.service';
import type { RetrievedContext } from '../../retrieval/types/retrieved-context.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkspaceLlmResolver } from '../../../workspace-ai/workspace-llm.resolver';
import { PrismaArchitectureDataSource } from '../dependency-mapping/data/prisma-architecture-data-source';
import { DependencyGraphProvider } from '../dependency-mapping/dependency-graph.provider';
import type { ArchitectureRevision } from '../dependency-mapping/types/architecture-snapshot.type';
import {
  coveredCitedPaths,
  extractCitedPaths,
  missingCitedPaths,
} from './cited-paths';
import { buildOverviewFacts, fitOverviewFacts } from './overview-facts';
import {
  appendLimitation,
  capOverviewMarkdown,
  deriveOverviewSummary,
  normalizeOverviewMarkdown,
} from './overview-markdown';
import { OverviewValidationError } from './overview-validation.error';
import { SystemOverviewPromptBuilder } from './system-overview-prompt.builder';
import {
  OVERVIEW_GENERATION_FAILED_MESSAGE,
  REDUCED_BASIS_STATEMENT,
  SYSTEM_OVERVIEW_LIMITS,
} from './system-overview.constants';

const EMPTY_RETRIEVAL: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

@Injectable()
export class SystemOverviewOrchestrator {
  private readonly logger = new Logger(SystemOverviewOrchestrator.name);
  private readonly topologyHints =
    createDefaultLanguagePackRegistry().topologyHints();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: PrismaArchitectureDataSource,
    private readonly graphProvider: DependencyGraphProvider,
    private readonly retrievalService: RetrievalService,
    private readonly llmResolver: WorkspaceLlmResolver,
    private readonly promptBuilder: SystemOverviewPromptBuilder,
  ) {}

  async execute(runId: string): Promise<void> {
    const run = await this.prisma.architectureOverviewGenerationRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new NotFoundException(
        'Architecture overview generation run not found',
      );
    }
    if (run.status === ArchitectureOverviewGenerationStatus.SUCCEEDED) {
      return;
    }

    try {
      await this.prisma.architectureOverviewGenerationRun.update({
        where: { id: run.id },
        data: {
          status: ArchitectureOverviewGenerationStatus.RUNNING,
          error: null,
          startedAt: run.startedAt ?? new Date(),
          completedAt: null,
          completedStep: 0,
        },
      });

      const repository = await this.dataSource.findRepositoryInWorkspace(
        run.workspaceId,
        run.repositoryId,
      );
      if (!repository) {
        throw new OverviewValidationError(
          'Architecture overview generation could not find this repository.',
        );
      }

      const revision = await this.dataSource.findLatestSucceededRevision(
        run.repositoryId,
      );
      if (!revision) {
        throw new OverviewValidationError(
          'Architecture overview generation is unavailable until this repository finishes indexing.',
        );
      }

      await this.prisma.architectureOverviewGenerationRun.update({
        where: { id: run.id },
        data: {
          completedStep: 1,
          sourceIndexingRunId: revision.indexingRunId,
          sourceCommitSha: revision.commitSha,
          sourceBranch: revision.branch,
        },
      });

      const [graph, files] = await Promise.all([
        this.graphProvider.getGraph(run.repositoryId, revision.indexingRunId),
        this.dataSource.listFileInventory(
          run.repositoryId,
          revision.indexingRunId,
        ),
      ]);
      const facts = fitOverviewFacts(
        buildOverviewFacts(graph, files, this.topologyHints),
      );
      await this.touch(run.id, 2);

      let retrieved = EMPTY_RETRIEVAL;
      let retrievalUnavailable = false;
      try {
        retrieved = await this.retrievalService.retrieve({
          workspaceId: run.workspaceId,
          repositoryIds: [run.repositoryId],
          indexingRunIds: [revision.indexingRunId],
          query:
            'main modules, module dependencies, technologies, and architectural boundaries',
          topK: SYSTEM_OVERVIEW_LIMITS.retrievalTopK,
        });
      } catch (error) {
        retrievalUnavailable = true;
        this.logger.warn(
          `Overview retrieval failed for run ${run.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await this.touch(run.id, 3);

      const provider = await this.llmResolver.resolve(run.workspaceId);
      const generated = await provider.generate({
        messages: this.promptBuilder.build({
          repositoryName: repository.fullName,
          facts,
          retrieved,
          retrievalUnavailable,
        }),
        temperature: 0.2,
      });
      if (!generated.content.trim()) {
        throw new OverviewValidationError(
          'The model returned an empty architecture overview.',
        );
      }

      const title = `${repository.fullName} system overview`;
      let markdown = normalizeOverviewMarkdown(generated.content, title);
      const statements = limitationStatements({
        modulesAbsent: facts.modulesAbsent,
        partial: facts.partial,
        partialReasons: facts.partialReasons,
        retrievalUnavailable,
        contextTruncated: facts.contextTruncated,
      });
      for (const statement of statements) {
        markdown = appendLimitation(markdown, statement);
      }
      const capped = capOverviewMarkdown(markdown);
      markdown = capped.markdown;

      const citedPaths = extractCitedPaths(markdown);
      const indexed = await this.dataSource.listExistingPaths(
        run.repositoryId,
        revision.indexingRunId,
        citedPaths,
      );
      const missing = missingCitedPaths(
        citedPaths,
        coveredCitedPaths(citedPaths, indexed),
      );
      if (missing.length > 0) {
        this.logger.error(
          `Architecture overview run ${run.id} cited paths that are not in indexing revision ${revision.indexingRunId}: ${missing.join(', ')}`,
        );
        const listed = missing.slice(0, 8).join(', ');
        const extra =
          missing.length > 8 ? ` and ${missing.length - 8} more` : '';
        throw new OverviewValidationError(
          `The generated overview cited paths that are not in this indexing revision: ${listed}${extra}.`,
        );
      }

      await this.store({
        runId: run.id,
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
        title,
        markdown,
        summary: deriveOverviewSummary(markdown),
        revision,
        provider,
        model: generated.model,
        citedPaths,
        partial: facts.partial,
        modulesAbsent: facts.modulesAbsent,
        contextTruncated: facts.contextTruncated,
        documentTruncated: capped.truncated,
        retrievalUnavailable,
      });
    } catch (error) {
      const publicMessage =
        error instanceof OverviewValidationError
          ? error.publicMessage
          : OVERVIEW_GENERATION_FAILED_MESSAGE;
      this.logger.error(
        `Architecture overview run ${run.id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.markFailed(run.id, publicMessage);
      throw error;
    }
  }

  async recordTerminalFailure(runId: string, error: Error): Promise<void> {
    const run = await this.prisma.architectureOverviewGenerationRun.findUnique({
      where: { id: runId },
    });
    if (!run || run.status === ArchitectureOverviewGenerationStatus.SUCCEEDED) {
      return;
    }
    await this.markFailed(runId, OVERVIEW_GENERATION_FAILED_MESSAGE);
    this.logger.error(
      `Architecture overview run ${runId} ended after retries: ${error.message}`,
    );
  }

  private async store(input: {
    runId: string;
    workspaceId: string;
    repositoryId: string;
    title: string;
    markdown: string;
    summary: string;
    revision: ArchitectureRevision;
    provider: LlmProvider;
    model: string;
    citedPaths: string[];
    partial: boolean;
    modulesAbsent: boolean;
    contextTruncated: boolean;
    documentTruncated: boolean;
    retrievalUnavailable: boolean;
  }): Promise<void> {
    const metadata: Prisma.InputJsonObject = {
      provider: input.provider.name,
      model: input.model,
      citedPaths: input.citedPaths,
      partial: input.partial,
      modulesAbsent: input.modulesAbsent,
      contextTruncated: input.contextTruncated,
      documentTruncated: input.documentTruncated,
      retrievalUnavailable: input.retrievalUnavailable,
    };
    const document = {
      workspaceId: input.workspaceId,
      title: input.title,
      markdown: input.markdown,
      summary: input.summary,
      metadata,
      sourceIndexingRunId: input.revision.indexingRunId,
      sourceCommitSha: input.revision.commitSha,
      sourceBranch: input.revision.branch,
    };

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.architectureOverview.findUnique({
        where: { repositoryId: input.repositoryId },
        select: { id: true },
      });
      if (existing) {
        await tx.architectureOverview.update({
          where: { repositoryId: input.repositoryId },
          data: { ...document, generationVersion: { increment: 1 } },
        });
      } else {
        await tx.architectureOverview.create({
          data: {
            ...document,
            repositoryId: input.repositoryId,
            generationVersion: 1,
          },
        });
      }
      await tx.architectureOverviewGenerationRun.update({
        where: { id: input.runId },
        data: {
          status: ArchitectureOverviewGenerationStatus.SUCCEEDED,
          completedStep: SYSTEM_OVERVIEW_LIMITS.totalSteps,
          completedAt: new Date(),
          error: null,
          sourceIndexingRunId: input.revision.indexingRunId,
          sourceCommitSha: input.revision.commitSha,
          sourceBranch: input.revision.branch,
        },
      });
    });
  }

  private touch(runId: string, completedStep: number): Promise<unknown> {
    return this.prisma.architectureOverviewGenerationRun.update({
      where: { id: runId },
      data: { completedStep },
    });
  }

  private async markFailed(runId: string, message: string): Promise<void> {
    await this.prisma.architectureOverviewGenerationRun.updateMany({
      where: {
        id: runId,
        status: { not: ArchitectureOverviewGenerationStatus.SUCCEEDED },
      },
      data: {
        status: ArchitectureOverviewGenerationStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
  }
}

function limitationStatements(input: {
  modulesAbsent: boolean;
  partial: boolean;
  partialReasons: string[];
  retrievalUnavailable: boolean;
  contextTruncated: boolean;
}): string[] {
  const statements: string[] = [];
  if (input.modulesAbsent) {
    statements.push(REDUCED_BASIS_STATEMENT);
  }
  if (input.partial) {
    const reasons = input.partialReasons.join(' ');
    statements.push(
      reasons
        ? `The dependency graph for this revision is partial. ${reasons}`
        : 'The dependency graph for this revision is partial.',
    );
  }
  if (input.retrievalUnavailable) {
    statements.push(
      'Retrieved source was unavailable for this generation. Structural statements use the dependency map only.',
    );
  }
  if (input.contextTruncated) {
    statements.push(
      'Structured architecture facts were truncated to fit the context budget. The overview summarizes rather than enumerates.',
    );
  }
  return statements;
}
