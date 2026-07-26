import { Injectable } from '@nestjs/common';
import { Conversation, Message, MessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ConversationWithMessages = Conversation & {
  messages: Message[];
};

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    workspaceId: string;
    createdById: string;
    repositoryId?: string | null;
    title?: string | null;
  }): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        workspaceId: data.workspaceId,
        createdById: data.createdById,
        repositoryId: data.repositoryId ?? null,
        title: data.title ?? null,
      },
    });
  }

  findById(
    workspaceId: string,
    conversationId: string,
  ): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
        deletedAt: null,
      },
    });
  }

  findByIdWithMessages(
    workspaceId: string,
    conversationId: string,
  ): Promise<ConversationWithMessages | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  listByWorkspace(workspaceId: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(
    workspaceId: string,
    conversationId: string,
    data: { title?: string },
  ): Promise<Conversation | null> {
    const result = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        workspaceId,
        deletedAt: null,
      },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(workspaceId, conversationId);
  }

  async softDelete(
    workspaceId: string,
    conversationId: string,
  ): Promise<number> {
    const result = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        workspaceId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count;
  }

  createMessage(data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<Message> {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  listRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  touchUpdatedAt(conversationId: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
