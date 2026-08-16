import { GuideType, Prisma } from '@prisma/client';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { WorkspaceLlmResolver } from '../../../workspace-ai/workspace-llm.resolver';
import type { GuideGenerator } from '../interfaces/guide-generator.interface';
import { GuidePromptBuilder } from '../prompts/guide-prompt.builder';
import { GUIDE_TEMPLATE_CONTRACTS } from '../templates/guide-template.contract';
import type {
  GuideGenerationContext,
  GuideGenerationResult,
  GuideGenerationTarget,
} from '../types/guide-generation.type';
import {
  deriveGuideSummary,
  normalizeGuideMarkdown,
} from '../utils/guide-output.util';

export abstract class RetrievalBackedGuideGenerator implements GuideGenerator {
  abstract readonly type: GuideType;

  protected constructor(
    protected readonly retrievalService: RetrievalService,
    protected readonly workspaceLlmResolver: WorkspaceLlmResolver,
    private readonly promptBuilder: GuidePromptBuilder,
  ) {}

  abstract targets(context: GuideGenerationContext): GuideGenerationTarget[];

  protected abstract focusedQuery(
    context: GuideGenerationContext,
    target: GuideGenerationTarget,
  ): string;

  async generate(
    context: GuideGenerationContext,
    target: GuideGenerationTarget,
  ): Promise<GuideGenerationResult> {
    if (target.type !== this.type) {
      throw new Error(`Generator ${this.type} cannot generate ${target.type}`);
    }
    const query = this.focusedQuery(context, target);
    const retrievedContext = await this.retrievalService.retrieve({
      workspaceId: context.workspaceId,
      repositoryIds: [context.repositoryId],
      query,
      topK: 14,
    });
    const llmProvider = await this.workspaceLlmResolver.resolve(
      context.workspaceId,
    );
    const generation = await llmProvider.generate({
      messages: this.promptBuilder.build({
        context,
        target,
        contract: GUIDE_TEMPLATE_CONTRACTS[this.type],
        retrievedContext,
        focusedQuery: query,
      }),
      maxTokens: 2_500,
      temperature: 0.2,
    });
    const markdown = normalizeGuideMarkdown(
      generation.content,
      target.title,
      GUIDE_TEMPLATE_CONTRACTS[this.type],
    );

    return {
      type: this.type,
      slug: target.slug,
      title: target.title,
      markdown,
      summary: deriveGuideSummary(markdown),
      citations: retrievedContext.references,
      model: generation.model,
      metadata: {
        targetKey: target.key,
        targetPath: target.candidate?.path ?? null,
        sourceIndexingRunId: context.topology.source.indexingRunId,
        sourceCommitSha: context.topology.source.commitSha,
        evidencePaths: [
          ...new Set(retrievedContext.references.map((item) => item.filePath)),
        ],
        provider: llmProvider.name,
        model: generation.model,
        retrievalQuery: query,
      } as Prisma.InputJsonValue,
    };
  }
}
