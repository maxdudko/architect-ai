import { MessageRole, UsageMetric, UsagePeriod } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RetrievalService } from '../modules/retrieval/retrieval.service';
import { RepositoriesRepository } from '../repositories/repositories.repository';
import { UsageLimitExceededException } from '../usage/usage-limit.exception';
import { UsageService } from '../usage/usage.service';
import { WorkspaceLlmResolver } from '../workspace-ai/workspace-llm.resolver';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const workspaceId = 'workspace-1';
  const conversationId = 'conversation-1';
  const userId = 'user-1';

  let conversationsService: {
    requireConversation: jest.Mock;
    listRecentMessages: jest.Mock;
    createMessage: jest.Mock;
    touchUpdatedAt: jest.Mock;
    toMessageResponse: jest.Mock;
  };
  let usageService: { assertWithinLimit: jest.Mock };
  let workspaceLlmResolver: { resolve: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    conversationsService = {
      requireConversation: jest.fn(),
      listRecentMessages: jest.fn(),
      createMessage: jest.fn(),
      touchUpdatedAt: jest.fn(),
      toMessageResponse: jest.fn(),
    };
    usageService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    workspaceLlmResolver = { resolve: jest.fn() };
    service = new ChatService(
      conversationsService as unknown as ConversationsService,
      {} as RepositoriesRepository,
      {} as RetrievalService,
      {} as AnalyticsService,
      usageService as unknown as UsageService,
      workspaceLlmResolver as unknown as WorkspaceLlmResolver,
    );
  });

  it('does not persist a USER message when the AI question limit is exceeded', async () => {
    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.AI_QUESTIONS,
        used: 50,
        limit: 50,
        period: UsagePeriod.MONTHLY,
      }),
    );

    await expect(
      service.ask(workspaceId, conversationId, userId, 'How does auth work?'),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(conversationsService.createMessage).not.toHaveBeenCalled();
    expect(workspaceLlmResolver.resolve).not.toHaveBeenCalled();
  });

  it('does not persist a USER message when streaming is blocked by the limit', async () => {
    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.AI_QUESTIONS,
        used: 50,
        limit: 50,
        period: UsagePeriod.MONTHLY,
      }),
    );

    const events = [];
    for await (const event of service.stream(
      workspaceId,
      conversationId,
      userId,
      'How does auth work?',
    )) {
      events.push(event);
    }

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'error' }),
        { type: 'done' },
      ]),
    );
    expect(conversationsService.createMessage).not.toHaveBeenCalled();
    expect(
      events.some(
        (event) =>
          event.type === 'error' &&
          typeof event.message === 'string' &&
          event.message.includes('AI questions'),
      ),
    ).toBe(true);
  });

  it('checks the limit before preparing a turn', async () => {
    conversationsService.requireConversation.mockResolvedValue({
      id: conversationId,
      workspaceId,
      repositoryId: null,
    });
    conversationsService.listRecentMessages.mockResolvedValue([]);
    conversationsService.createMessage.mockResolvedValue({
      id: 'message-1',
      conversationId,
      role: MessageRole.USER,
      content: 'Hello',
      metadata: null,
      createdAt: new Date(),
    });

    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.AI_QUESTIONS,
        used: 1,
        limit: 1,
        period: UsagePeriod.MONTHLY,
      }),
    );

    await expect(
      service.ask(workspaceId, conversationId, userId, 'Hello'),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(conversationsService.requireConversation).not.toHaveBeenCalled();
  });
});
