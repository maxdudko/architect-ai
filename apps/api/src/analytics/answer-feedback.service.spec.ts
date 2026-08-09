import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnswerFeedbackRating, MessageRole } from '@prisma/client';
import { AnswerFeedbackService } from './answer-feedback.service';

describe('AnswerFeedbackService', () => {
  const prisma = {
    conversation: {
      findFirst: jest.fn(),
    },
    message: {
      findFirst: jest.fn(),
    },
    answerFeedback: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const repositoryAccessValidationService = {
    assertUserCanAccessRepository: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AnswerFeedbackService(
    prisma as never,
    repositoryAccessValidationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts feedback for assistant messages', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      workspaceId: 'ws-1',
      repositoryId: null,
    });
    prisma.message.findFirst.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: MessageRole.ASSISTANT,
    });
    prisma.answerFeedback.upsert.mockResolvedValue({
      id: 'fb-1',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      userId: 'user-1',
      rating: AnswerFeedbackRating.HELPFUL,
      createdAt: new Date('2026-08-09T00:00:00.000Z'),
      updatedAt: new Date('2026-08-09T00:00:00.000Z'),
    });

    const result = await service.upsertFeedback({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      userId: 'user-1',
      rating: AnswerFeedbackRating.HELPFUL,
    });

    expect(result.rating).toBe(AnswerFeedbackRating.HELPFUL);
    expect(prisma.answerFeedback.upsert).toHaveBeenCalled();
  });

  it('rejects feedback on user messages', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      workspaceId: 'ws-1',
      repositoryId: null,
    });
    prisma.message.findFirst.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: MessageRole.USER,
    });

    await expect(
      service.upsertFeedback({
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        userId: 'user-1',
        rating: AnswerFeedbackRating.HELPFUL,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when conversation is missing', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.upsertFeedback({
        workspaceId: 'ws-1',
        conversationId: 'missing',
        messageId: 'msg-1',
        userId: 'user-1',
        rating: AnswerFeedbackRating.NOT_HELPFUL,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
