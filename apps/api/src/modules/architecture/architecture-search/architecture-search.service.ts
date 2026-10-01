import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MessageRole,
  Prisma,
  RepositoryStatus,
  UsageMetric,
  type Message,
} from '@prisma/client';
import { AnswerFeedbackService } from '../../../analytics/answer-feedback.service';
import { AnalyticsService } from '../../../analytics/analytics.service';
import { ConversationsRepository } from '../../../conversations/conversations.repository';
import type { LlmMessage } from '../../llm/interfaces/llm-provider.interface';
import { RetrievalService } from '../../retrieval/retrieval.service';
import type { RetrievedContext } from '../../retrieval/types/retrieved-context.type';
import { UsageService } from '../../../usage/usage.service';
import { WorkspaceLlmResolver } from '../../../workspace-ai/workspace-llm.resolver';
import { PrismaArchitectureDataSource } from '../dependency-mapping/data/prisma-architecture-data-source';
import { DependencyGraphProvider } from '../dependency-mapping/dependency-graph.provider';
import type { ArchitectureRevision } from '../dependency-mapping/types/architecture-snapshot.type';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import {
  ARCHITECTURE_SEARCH_LIMITS,
  ARCHITECTURE_SEARCH_METADATA_KIND,
  isStructuralIntent,
  type ArchitectureSearchIntent,
  type EpistemicLabel,
} from './architecture-search.constants';
import { ArchitectureSearchPromptBuilder } from './architecture-search-prompt.builder';
import {
  baseLimitations,
  deterministicReply,
  noRelationshipLimitation,
} from './architecture-search-reply';
import type {
  ArchitectureSearchAnswerDto,
  ArchitectureSearchThreadDto,
} from './dto/architecture-search.dto';
import {
  resolveModuleName,
  type ModuleNameResolution,
  type ResolvedModuleRef,
} from './module-name-resolver';
import {
  ClassifierOutputError,
  parseClassifierResponse,
} from './parse-classifier';
import {
  disclose,
  emptyNeighborhood,
  queryModuleNeighborhood,
  type BoundDisclosure,
  type StructuralFinding,
  type StructuralNeighborhood,
} from './structural-query';

const PROCESSING_STATUSES: RepositoryStatus[] = [
  RepositoryStatus.PENDING,
  RepositoryStatus.CLONING,
  RepositoryStatus.PARSING,
  RepositoryStatus.CHUNKING,
  RepositoryStatus.EMBEDDING,
];

const UNAVAILABLE_MESSAGE =
  'Architecture search is unavailable until this repository finishes indexing. Check the repository indexing state.';

const GENERATION_FAILED_MESSAGE =
  'Architecture search could not generate an answer. Try again.';

const EMPTY_RETRIEVAL: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

interface PreparedTurn {
  workspaceId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryStatus: RepositoryStatus;
  rebuildInProgress: boolean;
  revision: ArchitectureRevision;
  conversationId: string;
  userMessage: Message;
  question: string;
  graph: DependencyGraph;
}

interface RetrievedEvidence {
  repositoryId: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  name: string | null;
  qualifiedName: string | null;
  epistemic: 'INTERPRETED';
}

interface EntityResolutionState {
  outcome: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'NONE';
  query: string | null;
  module: ResolvedModuleRef | null;
  candidates: ResolvedModuleRef[];
  candidateBounds: BoundDisclosure;
}

interface Interpretation {
  intent: ArchitectureSearchIntent;
  epistemic: EpistemicLabel;
  resolution: EntityResolutionState;
  neighborhood: StructuralNeighborhood;
  limitations: string[];
  retrievedEvidence: RetrievedEvidence[];
  citationSources: RetrievedContext['references'];
  contextTruncated: boolean;
  content: string | null;
  messages: LlmMessage[] | null;
}

interface GeneratedText {
  content: string;
  model: string | null;
  provider: string | null;
  truncated: boolean;
}

interface StoredAnswerMetadata {
  kind: typeof ARCHITECTURE_SEARCH_METADATA_KIND;
  repositoryId: string;
  indexingRunId: string;
  branch: string | null;
  commitSha: string | null;
  completedAt: string | null;
  intent: ArchitectureSearchIntent;
  epistemic: EpistemicLabel;
  findings: StructuralFinding[];
  dependencyBounds: BoundDisclosure;
  dependentBounds: BoundDisclosure;
  entityResolution: EntityResolutionState;
  retrievedEvidence: RetrievedEvidence[];
  limitations: string[];
  truncated: boolean;
  contextTruncated: boolean;
  model: string | null;
  provider: string | null;
  rebuildInProgress: boolean;
}

export type ArchitectureSearchStreamEvent =
  | {
      type: 'revision';
      revision: ReturnType<typeof toRevisionDto>;
      rebuildInProgress: boolean;
    }
  | {
      type: 'findings';
      intent: ArchitectureSearchIntent;
      epistemic: EpistemicLabel;
      findings: StructuralFinding[];
      entityResolution: EntityResolutionState;
      limitations: string[];
      dependencyBounds: BoundDisclosure;
      dependentBounds: BoundDisclosure;
    }
  | { type: 'sources'; sources: RetrievedEvidence[] }
  | { type: 'token'; text: string }
  | { type: 'message'; answer: ArchitectureSearchAnswerDto }
  | { type: 'error'; message: string }
  | { type: 'done' };

@Injectable()
export class ArchitectureSearchService {
  private readonly logger = new Logger(ArchitectureSearchService.name);
  private readonly prompts = new ArchitectureSearchPromptBuilder();

  constructor(
    private readonly dataSource: PrismaArchitectureDataSource,
    private readonly graphProvider: DependencyGraphProvider,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly usageService: UsageService,
    private readonly workspaceLlmResolver: WorkspaceLlmResolver,
    private readonly retrievalService: RetrievalService,
    private readonly analyticsService: AnalyticsService,
    private readonly answerFeedbackService: AnswerFeedbackService,
  ) {}

  async getThread(
    workspaceId: string,
    repositoryId: string,
    userId: string,
  ): Promise<ArchitectureSearchThreadDto> {
    const repository = await this.requireRepository(workspaceId, repositoryId);
    const revision =
      await this.dataSource.findLatestSucceededRevision(repositoryId);
    const rebuildInProgress = PROCESSING_STATUSES.includes(repository.status);
    const conversation =
      await this.conversationsRepository.findArchitectureThread(
        workspaceId,
        repositoryId,
        userId,
      );

    if (!conversation) {
      return {
        conversationId: null,
        repositoryId,
        repositoryStatus: repository.status,
        indexingAvailable: revision != null,
        latestRevision: revision ? toRevisionDto(revision) : null,
        rebuildInProgress,
        turns: [],
      };
    }

    const messages = await this.conversationsRepository.listMessages(
      conversation.id,
    );
    const ratings = await this.answerFeedbackService.listRatingsForUser(
      messages
        .filter((message) => message.role === MessageRole.ASSISTANT)
        .map((message) => message.id),
      userId,
    );

    return {
      conversationId: conversation.id,
      repositoryId,
      repositoryStatus: repository.status,
      indexingAvailable: revision != null,
      latestRevision: revision ? toRevisionDto(revision) : null,
      rebuildInProgress,
      turns: pairTurns(
        messages,
        repository.status,
        revision?.indexingRunId ?? null,
        ratings,
      ),
    };
  }

  async ask(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    content: string,
  ): Promise<ArchitectureSearchAnswerDto> {
    const prepared = await this.prepareTurn(
      workspaceId,
      repositoryId,
      userId,
      content,
    );
    const interpretation = await this.interpret(prepared);
    const generated = interpretation.content
      ? {
          content: interpretation.content,
          model: null,
          provider: null,
          truncated: false,
        }
      : await this.generate(workspaceId, interpretation.messages ?? []);

    return this.persistAnswer(prepared, interpretation, generated);
  }

  async *stream(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    content: string,
  ): AsyncIterable<ArchitectureSearchStreamEvent> {
    try {
      const prepared = await this.prepareTurn(
        workspaceId,
        repositoryId,
        userId,
        content,
      );
      yield {
        type: 'revision',
        revision: toRevisionDto(prepared.revision),
        rebuildInProgress: prepared.rebuildInProgress,
      };

      const interpretation = await this.interpret(prepared);
      yield {
        type: 'findings',
        intent: interpretation.intent,
        epistemic: interpretation.epistemic,
        findings: interpretation.neighborhood.findings,
        entityResolution: interpretation.resolution,
        limitations: interpretation.limitations,
        dependencyBounds: interpretation.neighborhood.dependencyBounds,
        dependentBounds: interpretation.neighborhood.dependentBounds,
      };
      yield { type: 'sources', sources: interpretation.retrievedEvidence };

      let streamed: GeneratedText;
      if (interpretation.content) {
        streamed = {
          content: interpretation.content,
          model: null,
          provider: null,
          truncated: false,
        };
      } else {
        const llmProvider = await this.workspaceLlmResolver.resolve(
          prepared.workspaceId,
        );
        let content = '';
        let model = llmProvider.name;
        let truncated = false;
        try {
          for await (const event of llmProvider.stream({
            messages: interpretation.messages ?? [],
          })) {
            if (event.type === 'token') {
              content += event.text;
              yield { type: 'token', text: event.text };
            } else if (event.type === 'done') {
              content = event.content || content;
              model = event.model;
            }
          }
        } catch (error) {
          truncated = content.length > 0;
          if (!truncated) {
            throw error;
          }
          this.logger.warn(
            `Architecture search stream failed after partial content for repository ${repositoryId}`,
          );
        }
        streamed = {
          content,
          model,
          provider: llmProvider.name,
          truncated,
        };
      }

      const answer = await this.persistAnswer(
        prepared,
        interpretation,
        streamed,
      );
      yield { type: 'message', answer };
      yield { type: 'done' };
    } catch (error) {
      this.logger.error(
        `Architecture search failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      yield { type: 'error', message: publicErrorMessage(error) };
      yield { type: 'done' };
    }
  }

  private async prepareTurn(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    content: string,
  ): Promise<PreparedTurn> {
    const question = content.trim();
    if (
      question.length === 0 ||
      question.length > ARCHITECTURE_SEARCH_LIMITS.questionMaxLength
    ) {
      throw new BadRequestException(
        `A question must be between 1 and ${ARCHITECTURE_SEARCH_LIMITS.questionMaxLength} characters.`,
      );
    }

    const repository = await this.requireRepository(workspaceId, repositoryId);
    const revision =
      await this.dataSource.findLatestSucceededRevision(repositoryId);
    if (!revision) {
      throw new BadRequestException(UNAVAILABLE_MESSAGE);
    }

    await this.usageService.assertWithinLimit(
      workspaceId,
      UsageMetric.AI_QUESTIONS,
    );

    const conversation =
      await this.conversationsRepository.findOrCreateArchitectureThread({
        workspaceId,
        repositoryId,
        createdById: userId,
      });
    const userMessage = await this.conversationsRepository.createMessage({
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: question,
    });
    await this.conversationsRepository.touchUpdatedAt(conversation.id);

    const graph = await this.graphProvider.getGraph(
      repositoryId,
      revision.indexingRunId,
    );

    return {
      workspaceId,
      repositoryId,
      repositoryName: repository.fullName,
      repositoryStatus: repository.status,
      rebuildInProgress: PROCESSING_STATUSES.includes(repository.status),
      revision,
      conversationId: conversation.id,
      userMessage,
      question,
      graph,
    };
  }

  private async interpret(prepared: PreparedTurn): Promise<Interpretation> {
    const classified = await this.classify(prepared);
    const entity = classified.entities[0] ?? null;
    const resolution = entity
      ? resolveModuleName(
          prepared.graph.modules,
          entity,
          prepared.graph.filePathsByModule,
        )
      : null;
    const resolutionState = toResolutionState(entity, resolution);
    const fixed = deterministicReply({
      intent: classified.intent,
      resolution,
      entity,
      noModules: prepared.graph.modules.length === 0,
    });

    if (fixed) {
      return {
        intent: classified.intent,
        epistemic: fixed.epistemic,
        resolution: resolutionState,
        neighborhood: emptyNeighborhood(),
        limitations: baseLimitations(),
        retrievedEvidence: [],
        citationSources: [],
        contextTruncated: false,
        content: fixed.content,
        messages: null,
      };
    }

    const neighborhood =
      isStructuralIntent(classified.intent) &&
      resolution?.outcome === 'RESOLVED'
        ? queryModuleNeighborhood(
            prepared.graph,
            prepared.repositoryId,
            resolution.module.key,
            classified.intent,
          )
        : emptyNeighborhood();

    const retrieval = await this.loadRetrieval(prepared, classified.intent);
    if (retrieval.unavailable && !isStructuralIntent(classified.intent)) {
      throw new ServiceUnavailableException(GENERATION_FAILED_MESSAGE);
    }

    const limitations = baseLimitations([
      ...(isStructuralIntent(classified.intent) &&
      neighborhood.findings.length === 0
        ? [noRelationshipLimitation(classified.intent)]
        : []),
      ...(retrieval.unavailable
        ? ['Supporting source retrieval was unavailable for this answer.']
        : []),
      ...(prepared.graph.partial ? prepared.graph.partialReasons : []),
    ]);

    const prompt = this.prompts.buildAnswer({
      question: prepared.question,
      repositoryName: prepared.repositoryName,
      revisionLabel:
        prepared.revision.commitSha ?? prepared.revision.indexingRunId,
      intent: classified.intent,
      findings: neighborhood.findings,
      limitations,
      retrieved: retrieval.context,
    });

    return {
      intent: classified.intent,
      epistemic: epistemicFor(classified.intent),
      resolution: resolutionState,
      neighborhood,
      limitations,
      retrievedEvidence: retrieval.evidence,
      citationSources: retrieval.context.references,
      contextTruncated: prompt.contextTruncated,
      content: null,
      messages: prompt.messages,
    };
  }

  private async classify(
    prepared: PreparedTurn,
  ): Promise<{ intent: ArchitectureSearchIntent; entities: string[] }> {
    try {
      const llmProvider = await this.workspaceLlmResolver.resolve(
        prepared.workspaceId,
      );
      const generated = await llmProvider.generate({
        messages: this.prompts.buildClassifier({
          question: prepared.question,
          modules: prepared.graph.modules,
        }),
      });
      return parseClassifierResponse(generated.content);
    } catch (error) {
      if (error instanceof ClassifierOutputError) {
        throw new ServiceUnavailableException(GENERATION_FAILED_MESSAGE);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `Architecture search classifier failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new ServiceUnavailableException(GENERATION_FAILED_MESSAGE);
    }
  }

  private async loadRetrieval(
    prepared: PreparedTurn,
    intent: ArchitectureSearchIntent,
  ): Promise<{
    context: RetrievedContext;
    evidence: RetrievedEvidence[];
    unavailable: boolean;
  }> {
    try {
      const context = await this.retrievalService.retrieve({
        query: prepared.question,
        workspaceId: prepared.workspaceId,
        repositoryIds: [prepared.repositoryId],
        indexingRunIds: [prepared.revision.indexingRunId],
        topK: ARCHITECTURE_SEARCH_LIMITS.retrievalTopK,
      });
      return {
        context,
        evidence: context.references.map((reference) => ({
          repositoryId: reference.repositoryId,
          filePath: reference.filePath,
          startLine: reference.startLine,
          endLine: reference.endLine,
          name: reference.symbolName,
          qualifiedName: reference.qualifiedName,
          epistemic: 'INTERPRETED' as const,
        })),
        unavailable: false,
      };
    } catch (error) {
      this.logger.warn(
        `Architecture search retrieval failed for ${intent}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { context: EMPTY_RETRIEVAL, evidence: [], unavailable: true };
    }
  }

  private async generate(
    workspaceId: string,
    messages: LlmMessage[],
  ): Promise<GeneratedText> {
    try {
      const llmProvider = await this.workspaceLlmResolver.resolve(workspaceId);
      const generated = await llmProvider.generate({ messages });
      return {
        content: generated.content,
        model: generated.model,
        provider: llmProvider.name,
        truncated: false,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `Architecture search generation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new ServiceUnavailableException(GENERATION_FAILED_MESSAGE);
    }
  }

  private async persistAnswer(
    prepared: PreparedTurn,
    interpretation: Interpretation,
    generated: GeneratedText,
  ): Promise<ArchitectureSearchAnswerDto> {
    const metadata: StoredAnswerMetadata = {
      kind: ARCHITECTURE_SEARCH_METADATA_KIND,
      repositoryId: prepared.repositoryId,
      indexingRunId: prepared.revision.indexingRunId,
      branch: prepared.revision.branch,
      commitSha: prepared.revision.commitSha,
      completedAt: prepared.revision.completedAt?.toISOString() ?? null,
      intent: interpretation.intent,
      epistemic: interpretation.epistemic,
      findings: interpretation.neighborhood.findings,
      dependencyBounds: interpretation.neighborhood.dependencyBounds,
      dependentBounds: interpretation.neighborhood.dependentBounds,
      entityResolution: interpretation.resolution,
      retrievedEvidence: interpretation.retrievedEvidence,
      limitations: interpretation.limitations,
      truncated: generated.truncated,
      contextTruncated: interpretation.contextTruncated,
      model: generated.model,
      provider: generated.provider,
      rebuildInProgress: prepared.rebuildInProgress,
    };

    const assistantMessage = await this.conversationsRepository.createMessage({
      conversationId: prepared.conversationId,
      role: MessageRole.ASSISTANT,
      content: generated.content,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });

    if (interpretation.citationSources.length > 0) {
      await this.analyticsService.recordSourceCitations({
        messageId: assistantMessage.id,
        workspaceId: prepared.workspaceId,
        sources: interpretation.citationSources,
      });
    }
    await this.conversationsRepository.touchUpdatedAt(prepared.conversationId);

    return toAnswerDto({
      conversationId: prepared.conversationId,
      userMessageId: prepared.userMessage.id,
      assistantMessageId: assistantMessage.id,
      repositoryId: prepared.repositoryId,
      repositoryStatus: prepared.repositoryStatus,
      metadata,
      content: generated.content,
      historical: false,
      feedbackRating: null,
    });
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

function epistemicFor(intent: ArchitectureSearchIntent): EpistemicLabel {
  if (isStructuralIntent(intent)) {
    return 'OBSERVED';
  }
  if (intent === 'NOT_ESTABLISHABLE') {
    return 'NOT_ESTABLISHABLE';
  }
  return 'INTERPRETED';
}

function toResolutionState(
  entity: string | null,
  resolution: ModuleNameResolution | null,
): EntityResolutionState {
  if (!entity || !resolution) {
    return {
      outcome: 'NONE',
      query: entity,
      module: null,
      candidates: [],
      candidateBounds: disclose(
        ARCHITECTURE_SEARCH_LIMITS.ambiguousCandidates,
        0,
        0,
      ),
    };
  }

  if (resolution.outcome === 'RESOLVED') {
    return {
      outcome: 'RESOLVED',
      query: entity,
      module: resolution.module,
      candidates: [resolution.module],
      candidateBounds: disclose(1, 1, 1),
    };
  }

  if (resolution.outcome === 'AMBIGUOUS') {
    return {
      outcome: 'AMBIGUOUS',
      query: entity,
      module: null,
      candidates: resolution.candidates,
      candidateBounds: disclose(
        ARCHITECTURE_SEARCH_LIMITS.ambiguousCandidates,
        resolution.candidates.length,
        resolution.total,
      ),
    };
  }

  return {
    outcome: 'NOT_FOUND',
    query: entity,
    module: null,
    candidates: resolution.nearCandidates,
    candidateBounds: disclose(
      ARCHITECTURE_SEARCH_LIMITS.nearCandidates,
      resolution.nearCandidates.length,
      resolution.nearCandidates.length,
    ),
  };
}

function toRevisionDto(revision: ArchitectureRevision) {
  return {
    indexingRunId: revision.indexingRunId,
    branch: revision.branch,
    commitSha: revision.commitSha,
    completedAt: revision.completedAt?.toISOString() ?? null,
  };
}

function toAnswerDto(input: {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  repositoryId: string;
  repositoryStatus: RepositoryStatus;
  metadata: StoredAnswerMetadata;
  content: string;
  historical: boolean;
  feedbackRating: 'HELPFUL' | 'NOT_HELPFUL' | null;
}): ArchitectureSearchAnswerDto {
  return {
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    assistantMessageId: input.assistantMessageId,
    repositoryId: input.repositoryId,
    repositoryStatus: input.repositoryStatus,
    revision: {
      indexingRunId: input.metadata.indexingRunId,
      branch: input.metadata.branch,
      commitSha: input.metadata.commitSha,
      completedAt: input.metadata.completedAt,
    },
    rebuildInProgress: input.metadata.rebuildInProgress,
    historical: input.historical,
    intent: input.metadata.intent,
    epistemic: input.metadata.epistemic,
    content: input.content,
    truncated: input.metadata.truncated,
    contextTruncated: input.metadata.contextTruncated,
    findings: input.metadata.findings,
    dependencyBounds: input.metadata.dependencyBounds,
    dependentBounds: input.metadata.dependentBounds,
    entityResolution: input.metadata.entityResolution,
    retrievedEvidence: input.metadata.retrievedEvidence,
    limitations: input.metadata.limitations,
    feedbackRating: input.feedbackRating,
  };
}

function pairTurns(
  messages: Message[],
  repositoryStatus: RepositoryStatus,
  latestIndexingRunId: string | null,
  ratings: Map<string, 'HELPFUL' | 'NOT_HELPFUL'>,
): ArchitectureSearchThreadDto['turns'] {
  const turns: ArchitectureSearchThreadDto['turns'] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== MessageRole.USER) {
      continue;
    }
    const next = messages[index + 1];
    const assistant = next && next.role === MessageRole.ASSISTANT ? next : null;
    const metadata = assistant ? readMetadata(assistant.metadata) : null;

    turns.push({
      question: message.content,
      askedAt: message.createdAt.toISOString(),
      answer:
        assistant && metadata
          ? toAnswerDto({
              conversationId: message.conversationId,
              userMessageId: message.id,
              assistantMessageId: assistant.id,
              repositoryId: metadata.repositoryId,
              repositoryStatus,
              metadata,
              content: assistant.content,
              historical:
                latestIndexingRunId == null ||
                metadata.indexingRunId !== latestIndexingRunId,
              feedbackRating: ratings.get(assistant.id) ?? null,
            })
          : null,
    });
  }

  return turns;
}

function readMetadata(
  value: Prisma.JsonValue | null,
): StoredAnswerMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<StoredAnswerMetadata>;
  if (
    record.kind !== ARCHITECTURE_SEARCH_METADATA_KIND ||
    !record.indexingRunId ||
    !record.repositoryId
  ) {
    return null;
  }
  return record as StoredAnswerMetadata;
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }
    }
  }
  return GENERATION_FAILED_MESSAGE;
}
