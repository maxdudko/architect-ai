import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Conversation, Message, MessageRole, Prisma } from '@prisma/client';
import { RepositoryAccessValidationService } from '../repositories/repository-access-validation.service';
import {
  ConversationDetailResponseDto,
  ConversationResponseDto,
} from './dto/conversation-response.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  ConversationsRepository,
  type ConversationWithMessages,
} from './conversations.repository';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly repositoryAccessValidationService: RepositoryAccessValidationService,
  ) {}

  async createConversation(
    workspaceId: string,
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    if (dto.repositoryId) {
      await this.repositoryAccessValidationService.assertRepositoryInWorkspace({
        workspaceId,
        repositoryId: dto.repositoryId,
      });
    }

    const conversation = await this.conversationsRepository.create({
      workspaceId,
      createdById: userId,
      repositoryId: dto.repositoryId ?? null,
      title: dto.title ?? null,
    });

    return this.toConversationResponse(conversation);
  }

  async listConversations(
    workspaceId: string,
    _userId: string,
  ): Promise<ConversationResponseDto[]> {
    const conversations =
      await this.conversationsRepository.listByWorkspace(workspaceId);

    return conversations.map((conversation) =>
      this.toConversationResponse(conversation),
    );
  }

  async getConversation(
    workspaceId: string,
    conversationId: string,
    _userId: string,
  ): Promise<ConversationDetailResponseDto> {
    const conversation =
      await this.conversationsRepository.findByIdWithMessages(
        workspaceId,
        conversationId,
      );
    if (!conversation) {
      throw new NotFoundException('Conversation not found in this workspace');
    }
    return this.toConversationDetailResponse(conversation);
  }

  async updateConversation(
    workspaceId: string,
    conversationId: string,
    _userId: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    await this.requireConversation(workspaceId, conversationId);

    const title = dto.title !== undefined ? dto.title.trim() : undefined;
    if (title !== undefined && title.length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    const conversation = await this.conversationsRepository.update(
      workspaceId,
      conversationId,
      {
        ...(title !== undefined ? { title } : {}),
      },
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found in this workspace');
    }

    return this.toConversationResponse(conversation);
  }

  async deleteConversation(
    workspaceId: string,
    conversationId: string,
    _userId: string,
  ): Promise<{ success: boolean }> {
    await this.requireConversation(workspaceId, conversationId);
    const deletedCount = await this.conversationsRepository.softDelete(
      workspaceId,
      conversationId,
    );
    if (deletedCount === 0) {
      throw new NotFoundException('Conversation not found in this workspace');
    }
    return { success: true };
  }

  async requireConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findById(
      workspaceId,
      conversationId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found in this workspace');
    }
    return conversation;
  }

  createMessage(data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<Message> {
    return this.conversationsRepository.createMessage(data);
  }

  listRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    return this.conversationsRepository.listRecentMessages(
      conversationId,
      limit,
    );
  }

  touchUpdatedAt(conversationId: string): Promise<Conversation> {
    return this.conversationsRepository.touchUpdatedAt(conversationId);
  }

  toMessageResponse(
    message: Message,
    options?: { feedbackRating?: 'HELPFUL' | 'NOT_HELPFUL' | null },
  ): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      metadata: (message.metadata as Record<string, unknown> | null) ?? null,
      feedbackRating: options?.feedbackRating ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toConversationResponse(
    conversation: Conversation,
  ): ConversationResponseDto {
    return {
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      repositoryId: conversation.repositoryId,
      createdById: conversation.createdById,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toConversationDetailResponse(
    conversation: ConversationWithMessages,
  ): ConversationDetailResponseDto {
    return {
      ...this.toConversationResponse(conversation),
      messages: conversation.messages.map((message) =>
        this.toMessageResponse(message),
      ),
    };
  }
}
