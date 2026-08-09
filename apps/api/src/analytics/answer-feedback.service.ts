import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnswerFeedback,
  AnswerFeedbackRating,
  MessageRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RepositoryAccessValidationService } from '../repositories/repository-access-validation.service';
import { AnswerFeedbackResponseDto } from './dto/answer-feedback-response.dto';

@Injectable()
export class AnswerFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repositoryAccessValidationService: RepositoryAccessValidationService,
  ) {}

  async upsertFeedback(params: {
    workspaceId: string;
    conversationId: string;
    messageId: string;
    userId: string;
    rating: AnswerFeedbackRating;
  }): Promise<AnswerFeedbackResponseDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        workspaceId: params.workspaceId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found in this workspace');
    }

    if (conversation.repositoryId) {
      await this.repositoryAccessValidationService.assertUserCanAccessRepository(
        {
          workspaceId: params.workspaceId,
          repositoryId: conversation.repositoryId,
          userId: params.userId,
        },
      );
    }

    const message = await this.prisma.message.findFirst({
      where: {
        id: params.messageId,
        conversationId: params.conversationId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found in this conversation');
    }

    if (message.role !== MessageRole.ASSISTANT) {
      throw new BadRequestException(
        'Feedback is only allowed on assistant messages',
      );
    }

    const feedback = await this.prisma.answerFeedback.upsert({
      where: {
        messageId_userId: {
          messageId: params.messageId,
          userId: params.userId,
        },
      },
      create: {
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        userId: params.userId,
        rating: params.rating,
      },
      update: {
        rating: params.rating,
      },
    });

    return this.toResponse(feedback);
  }

  async listRatingsForUser(
    messageIds: string[],
    userId: string,
  ): Promise<Map<string, AnswerFeedbackRating>> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.answerFeedback.findMany({
      where: {
        messageId: { in: messageIds },
        userId,
      },
      select: {
        messageId: true,
        rating: true,
      },
    });

    return new Map(rows.map((row) => [row.messageId, row.rating]));
  }

  private toResponse(feedback: AnswerFeedback): AnswerFeedbackResponseDto {
    return {
      id: feedback.id,
      messageId: feedback.messageId,
      conversationId: feedback.conversationId,
      workspaceId: feedback.workspaceId,
      userId: feedback.userId,
      rating: feedback.rating,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
    };
  }
}
