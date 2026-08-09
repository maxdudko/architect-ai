import { Inject, Injectable, Logger } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessageResponseDto } from '../conversations/dto/message-response.dto';
import type { LlmProvider } from '../modules/llm/interfaces/llm-provider.interface';
import { LLM_PROVIDER } from '../modules/llm/interfaces/tokens';
import { RetrievalService } from '../modules/retrieval/retrieval.service';
import type { RetrievedChunkReference } from '../modules/retrieval/types/retrieved-context.type';
import { RepositoryAccessValidationService } from '../repositories/repository-access-validation.service';
import { RepositoriesRepository } from '../repositories/repositories.repository';
import { ChatAnswerResponseDto } from './dto/chat-answer-response.dto';
import { PromptContextBuilder } from './prompt-context.builder';

export type ChatStreamEvent =
  | { type: 'token'; text: string }
  | {
      type: 'sources';
      sources: RetrievedChunkReference[];
    }
  | {
      type: 'message';
      userMessage: MessageResponseDto;
      assistantMessage: MessageResponseDto;
    }
  | { type: 'error'; message: string }
  | { type: 'done' };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly promptBuilder = new PromptContextBuilder();

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly repositoryAccessValidationService: RepositoryAccessValidationService,
    private readonly retrievalService: RetrievalService,
    private readonly analyticsService: AnalyticsService,
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
  ) {}

  async ask(
    workspaceId: string,
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<ChatAnswerResponseDto> {
    const prepared = await this.prepareTurn(
      workspaceId,
      conversationId,
      userId,
      content,
    );

    const generation = await this.llmProvider.generate({
      messages: prepared.messages,
    });

    const assistantMessage = await this.persistAssistantMessage({
      conversationId,
      workspaceId,
      content: generation.content,
      sources: prepared.sources,
      model: generation.model,
      usage: generation.usage,
      truncated: false,
    });

    return {
      userMessage: this.conversationsService.toMessageResponse(
        prepared.userMessage,
      ),
      assistantMessage:
        this.conversationsService.toMessageResponse(assistantMessage),
      sources: prepared.sources,
    };
  }

  async *stream(
    workspaceId: string,
    conversationId: string,
    userId: string,
    content: string,
  ): AsyncIterable<ChatStreamEvent> {
    try {
      const prepared = await this.prepareTurn(
        workspaceId,
        conversationId,
        userId,
        content,
      );

      yield { type: 'sources', sources: prepared.sources };

      let fullContent = '';
      let model = this.llmProvider.name;
      let usage: { inputTokens?: number; outputTokens?: number } | undefined;
      let truncated = false;

      try {
        for await (const event of this.llmProvider.stream({
          messages: prepared.messages,
        })) {
          if (event.type === 'token') {
            fullContent += event.text;
            yield { type: 'token', text: event.text };
          } else if (event.type === 'done') {
            fullContent = event.content || fullContent;
            model = event.model;
            usage = event.usage;
          }
        }
      } catch (error) {
        truncated = fullContent.length > 0;
        if (!truncated) {
          throw error;
        }
        this.logger.warn(
          `LLM stream failed after partial content for conversation ${conversationId}`,
        );
      }

      const assistantMessage = await this.persistAssistantMessage({
        conversationId,
        workspaceId,
        content: fullContent,
        sources: prepared.sources,
        model,
        usage,
        truncated,
      });

      yield {
        type: 'message',
        userMessage: this.conversationsService.toMessageResponse(
          prepared.userMessage,
        ),
        assistantMessage:
          this.conversationsService.toMessageResponse(assistantMessage),
      };
      yield { type: 'done' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate answer';
      this.logger.error(
        `Chat stream failed for conversation ${conversationId}: ${message}`,
      );
      yield { type: 'error', message };
      yield { type: 'done' };
    }
  }

  private async prepareTurn(
    workspaceId: string,
    conversationId: string,
    userId: string,
    content: string,
  ) {
    const conversation = await this.conversationsService.requireConversation(
      workspaceId,
      conversationId,
    );

    const history = await this.conversationsService.listRecentMessages(
      conversationId,
      12,
    );

    const userMessage = await this.conversationsService.createMessage({
      conversationId,
      role: MessageRole.USER,
      content,
    });

    const repository = conversation.repositoryId
      ? await this.repositoriesRepository.findById(
          workspaceId,
          conversation.repositoryId,
        )
      : null;

    if (conversation.repositoryId) {
      await this.repositoryAccessValidationService.assertUserCanAccessRepository(
        {
          workspaceId,
          repositoryId: conversation.repositoryId,
          userId,
        },
      );
    }

    const retrievedContext = await this.retrievalService.retrieve({
      query: content,
      workspaceId,
      repositoryIds: conversation.repositoryId
        ? [conversation.repositoryId]
        : undefined,
      topK: 12,
    });

    const messages = this.promptBuilder.build({
      question: content,
      repository,
      retrievedContext,
      history,
    });

    await this.conversationsService.touchUpdatedAt(conversationId);

    return {
      userMessage,
      messages,
      sources: retrievedContext.references,
    };
  }

  private async persistAssistantMessage(params: {
    conversationId: string;
    workspaceId: string;
    content: string;
    sources: RetrievedChunkReference[];
    model: string;
    usage?: { inputTokens?: number; outputTokens?: number };
    truncated: boolean;
  }) {
    const metadata = {
      sources: params.sources,
      model: params.model,
      usage: params.usage ?? null,
      truncated: params.truncated,
      provider: this.llmProvider.name,
    } as unknown as Prisma.InputJsonValue;

    const assistantMessage = await this.conversationsService.createMessage({
      conversationId: params.conversationId,
      role: MessageRole.ASSISTANT,
      content: params.content,
      metadata,
    });

    await this.analyticsService.recordSourceCitations({
      messageId: assistantMessage.id,
      workspaceId: params.workspaceId,
      sources: params.sources,
    });

    await this.conversationsService.touchUpdatedAt(params.conversationId);
    return assistantMessage;
  }
}
