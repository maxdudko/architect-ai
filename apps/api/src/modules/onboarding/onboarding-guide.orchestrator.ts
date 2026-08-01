import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GuideGenerationStatus, GuideType } from '@prisma/client';
import { GuideGeneratorRegistry } from './generators/guide-generator.registry';
import type { OnboardingGuideStorage } from './interfaces/onboarding-guide-storage.interface';
import { ONBOARDING_GUIDE_STORAGE } from './interfaces/tokens';
import { IndexedTopologyAnalyzer } from './guides/indexed-topology-analyzer';
import type {
  GuideGenerationContext,
  GuideGenerationResult,
  GuideGenerationTarget,
  PriorGuideSummary,
} from './types/guide-generation.type';
import type { OnboardingGuideGenerationRun } from './types/guide-generation-run.type';

const SYNTHESIS_TYPES = new Set<GuideType>([
  GuideType.READING_ORDER,
  GuideType.GLOSSARY,
  GuideType.COMMON_PITFALLS,
]);

@Injectable()
export class OnboardingGuideOrchestrator {
  private readonly logger = new Logger(OnboardingGuideOrchestrator.name);

  constructor(
    @Inject(ONBOARDING_GUIDE_STORAGE)
    private readonly storage: OnboardingGuideStorage,
    private readonly topologyAnalyzer: IndexedTopologyAnalyzer,
    private readonly generatorRegistry: GuideGeneratorRegistry,
  ) {}

  async execute(runId: string): Promise<OnboardingGuideGenerationRun> {
    const run = await this.storage.getGenerationRun(runId);
    if (!run) {
      throw new NotFoundException(`Guide generation run ${runId} not found`);
    }

    const errors: Array<Record<string, string>> = [];
    let activeTarget: GuideGenerationTarget | null = null;

    try {
      await this.storage.validateRepository(run.workspaceId, run.repositoryId);
      await this.requireRunUpdate(run, {
        status: GuideGenerationStatus.RUNNING,
        completedGuideCount: 0,
        error: null,
        errors: null,
        startedAt: new Date(),
        completedAt: null,
      });

      const requestedTypes = this.resolveRequestedTypes(run.requestedTypes);
      const topology = await this.topologyAnalyzer.analyze(
        run.workspaceId,
        run.repositoryId,
      );
      const baseContext: GuideGenerationContext = {
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
        topology,
      };
      const work = this.buildWork(requestedTypes, baseContext);

      await this.requireRunUpdate(run, {
        totalGuideCount: work.length,
        completedGuideCount: 0,
      });

      const results: GuideGenerationResult[] = [];
      const existingGuides = await this.storage.listGuides(
        run.workspaceId,
        run.repositoryId,
      );
      const requestedTypeSet = new Set(requestedTypes);
      const summaries: PriorGuideSummary[] = existingGuides
        .filter(
          (guide) =>
            !requestedTypeSet.has(guide.type) &&
            !SYNTHESIS_TYPES.has(guide.type) &&
            Boolean(guide.summary),
        )
        .map((guide) => ({
          type: guide.type,
          slug: guide.slug,
          title: guide.title,
          summary: guide.summary?.slice(0, 320) ?? '',
        }));
      for (const item of work) {
        activeTarget = item.target;
        const result = await item.generator.generate(
          {
            ...baseContext,
            priorGuides: [...summaries],
          },
          item.target,
        );
        results.push(result);
        summaries.push({
          type: result.type,
          slug: result.slug,
          title: result.title,
          summary: result.summary.slice(0, 320),
        });
        await this.requireRunUpdate(run, {
          completedGuideCount: results.length,
        });
      }

      await this.storage.replaceGuideSet({
        workspaceId: run.workspaceId,
        repositoryId: run.repositoryId,
        replacedTypes: requestedTypes,
        guides: results.map((result) => ({
          type: result.type,
          slug: result.slug,
          title: result.title,
          markdown: result.markdown,
          summary: result.summary,
          metadata: result.metadata,
        })),
        sourceIndexingRunId:
          run.sourceIndexingRunId ?? topology.source.indexingRunId,
        sourceCommitSha: run.sourceCommitSha ?? topology.source.commitSha,
      });

      return this.requireRunUpdate(run, {
        status: GuideGenerationStatus.SUCCEEDED,
        completedGuideCount: results.length,
        completedAt: new Date(),
        error: null,
        errors: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        message,
        ...(activeTarget
          ? {
              guideType: activeTarget.type,
              targetKey: activeTarget.key,
            }
          : {}),
      });
      this.logger.error(`Guide generation run ${run.id} failed: ${message}`);
      await this.markFailedSafely(run, message, errors);
      throw error;
    }
  }

  async recordTerminalFailure(runId: string, error: Error): Promise<void> {
    const run = await this.storage.getGenerationRun(runId);
    if (!run || run.status === GuideGenerationStatus.SUCCEEDED) {
      return;
    }
    await this.markFailedSafely(run, error.message, [
      { message: error.message, source: 'worker' },
    ]);
  }

  private buildWork(
    requestedTypes: GuideType[],
    context: GuideGenerationContext,
  ): Array<{
    generator: ReturnType<GuideGeneratorRegistry['get']>;
    target: GuideGenerationTarget;
  }> {
    const orderedTypes = [
      ...requestedTypes.filter((type) => !SYNTHESIS_TYPES.has(type)),
      ...requestedTypes.filter((type) => SYNTHESIS_TYPES.has(type)),
    ];
    return orderedTypes.flatMap((type) => {
      const generator = this.generatorRegistry.get(type);
      return generator
        .targets(context)
        .map((target) => ({ generator, target }));
    });
  }

  private resolveRequestedTypes(requestedTypes: GuideType[]): GuideType[] {
    const validTypes = new Set(Object.values(GuideType));
    const resolved = [...new Set(requestedTypes)];
    if (resolved.length === 0) {
      throw new Error('Guide generation run has no requested guide types');
    }
    for (const type of resolved) {
      if (!validTypes.has(type)) {
        throw new Error(`Unsupported guide type: ${String(type)}`);
      }
    }
    return resolved;
  }

  private async requireRunUpdate(
    run: OnboardingGuideGenerationRun,
    update: Parameters<OnboardingGuideStorage['updateGenerationRun']>[3],
  ): Promise<OnboardingGuideGenerationRun> {
    const updated = await this.storage.updateGenerationRun(
      run.workspaceId,
      run.repositoryId,
      run.id,
      update,
    );
    if (!updated) {
      throw new NotFoundException(`Guide generation run ${run.id} not found`);
    }
    return updated;
  }

  private async markFailedSafely(
    run: OnboardingGuideGenerationRun,
    message: string,
    errors: Array<Record<string, string>>,
  ): Promise<void> {
    try {
      await this.storage.updateGenerationRun(
        run.workspaceId,
        run.repositoryId,
        run.id,
        {
          status: GuideGenerationStatus.FAILED,
          error: message,
          errors,
          completedAt: new Date(),
        },
      );
    } catch (updateError) {
      this.logger.error(
        `Could not record failure for guide generation run ${run.id}: ${
          updateError instanceof Error
            ? updateError.message
            : String(updateError)
        }`,
      );
    }
  }
}
