import {
  ForbiddenException,
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
      await this.repositoryAccessValidationService.assertUserCanAccessRepository(
        {
          workspaceId,
          repositoryId: dto.repositoryId,
          userId,
        },
      );
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
    userId: string,
  ): Promise<ConversationResponseDto[]> {
    const conversations =
      await this.conversationsRepository.listByWorkspace(workspaceId);

    const accessibleRepositoryIds = await this.resolveAccessibleRepositoryIds(
      workspaceId,
      userId,
      conversations
        .map((conversation) => conversation.repositoryId)
        .filter((repositoryId): repositoryId is string => repositoryId != null),
    );

    return conversations
      .filter((conversation) => {
        if (!conversation.repositoryId) {
          return true;
        }
        return accessibleRepositoryIds.has(conversation.repositoryId);
      })
      .map((conversation) => this.toConversationResponse(conversation));
  }

  async getConversation(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ): Promise<ConversationDetailResponseDto> {
    const conversation =
      await this.conversationsRepository.findByIdWithMessages(
        workspaceId,
        conversationId,
      );
    if (!conversation) {
      throw new NotFoundException('Conversation not found in this workspace');
    }
    await this.assertConversationRepositoryAccess(
      workspaceId,
      userId,
      conversation.repositoryId,
    );
    return this.toConversationDetailResponse(conversation);
  }

  async updateConversation(
    workspaceId: string,
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    const existing = await this.requireConversation(
      workspaceId,
      conversationId,
    );
    await this.assertConversationRepositoryAccess(
      workspaceId,
      userId,
      existing.repositoryId,
    );

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
    userId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.requireConversation(
      workspaceId,
      conversationId,
    );
    await this.assertConversationRepositoryAccess(
      workspaceId,
      userId,
      existing.repositoryId,
    );
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

  toMessageResponse(message: Message): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      metadata: (message.metadata as Record<string, unknown> | null) ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async assertConversationRepositoryAccess(
    workspaceId: string,
    userId: string,
    repositoryId: string | null,
  ): Promise<void> {
    if (!repositoryId) {
      return;
    }
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });
  }

  private async resolveAccessibleRepositoryIds(
    workspaceId: string,
    userId: string,
    repositoryIds: string[],
  ): Promise<Set<string>> {
    const accessible = new Set<string>();
    const uniqueRepositoryIds = [...new Set(repositoryIds)];

    for (const repositoryId of uniqueRepositoryIds) {
      try {
        await this.repositoryAccessValidationService.assertUserCanAccessRepository(
          {
            workspaceId,
            repositoryId,
            userId,
          },
        );
        accessible.add(repositoryId);
      } catch (error) {
        if (error instanceof ForbiddenException) {
          continue;
        }
        throw error;
      }
    }

    return accessible;
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
