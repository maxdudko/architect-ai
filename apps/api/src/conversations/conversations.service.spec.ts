import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationPurpose } from '@prisma/client';
import { RepositoryAccessValidationService } from '../repositories/repository-access-validation.service';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  const workspaceId = 'workspace-1';
  const userId = 'user-1';
  const repositoryId = 'repo-1';
  const conversationId = 'conversation-1';

  const baseConversation = {
    id: conversationId,
    workspaceId,
    repositoryId,
    createdById: userId,
    title: 'Auth flow',
    purpose: ConversationPurpose.CHAT,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  let conversationsRepository: jest.Mocked<ConversationsRepository>;
  let repositoryAccessValidationService: jest.Mocked<RepositoryAccessValidationService>;
  let service: ConversationsService;

  beforeEach(() => {
    conversationsRepository = {
      create: jest.fn(),
      listByWorkspace: jest.fn(),
      findById: jest.fn(),
      findByIdWithMessages: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      createMessage: jest.fn(),
      listRecentMessages: jest.fn(),
      touchUpdatedAt: jest.fn(),
    } as unknown as jest.Mocked<ConversationsRepository>;

    repositoryAccessValidationService = {
      assertRepositoryInWorkspace: jest.fn().mockResolvedValue(undefined),
      assertUserCanAccessRepository: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RepositoryAccessValidationService>;

    service = new ConversationsService(
      conversationsRepository,
      repositoryAccessValidationService,
    );
  });

  it('asserts repository belongs to workspace when creating a conversation', async () => {
    conversationsRepository.create.mockResolvedValue(baseConversation);

    await service.createConversation(workspaceId, userId, {
      repositoryId,
      title: 'Auth flow',
    });

    expect(
      repositoryAccessValidationService.assertRepositoryInWorkspace,
    ).toHaveBeenCalledWith({
      workspaceId,
      repositoryId,
    });
    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).not.toHaveBeenCalled();
    expect(conversationsRepository.create).toHaveBeenCalled();
  });

  it('allows getting a conversation without live GitHub access', async () => {
    conversationsRepository.findByIdWithMessages.mockResolvedValue({
      ...baseConversation,
      messages: [],
    });

    const result = await service.getConversation(
      workspaceId,
      conversationId,
      userId,
    );

    expect(result.id).toBe(conversationId);
    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).not.toHaveBeenCalled();
  });

  it('lists all workspace conversations without GitHub ACL filtering', async () => {
    const accessibleConversation = {
      ...baseConversation,
      id: 'conversation-accessible',
      repositoryId: 'repo-accessible',
    };
    const otherRepoConversation = {
      ...baseConversation,
      id: 'conversation-other-repo',
      repositoryId: 'repo-other',
    };
    const workspaceOnlyConversation = {
      ...baseConversation,
      id: 'conversation-workspace',
      repositoryId: null,
    };

    conversationsRepository.listByWorkspace.mockResolvedValue([
      accessibleConversation,
      otherRepoConversation,
      workspaceOnlyConversation,
    ]);

    const result = await service.listConversations(workspaceId, userId);

    expect(result.map((conversation) => conversation.id)).toEqual([
      'conversation-accessible',
      'conversation-other-repo',
      'conversation-workspace',
    ]);
    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).not.toHaveBeenCalled();
  });

  it('rethrows not-found when creating against a missing repository', async () => {
    repositoryAccessValidationService.assertRepositoryInWorkspace.mockRejectedValue(
      new NotFoundException('Repository not found in this workspace'),
    );

    await expect(
      service.createConversation(workspaceId, userId, { repositoryId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationsRepository.create).not.toHaveBeenCalled();
  });

  it('does not require GitHub access when listing conversations', async () => {
    conversationsRepository.listByWorkspace.mockResolvedValue([
      baseConversation,
    ]);
    repositoryAccessValidationService.assertUserCanAccessRepository.mockRejectedValue(
      new ForbiddenException(
        'Your GitHub account no longer has access to this repository. Reconnect GitHub or request access.',
      ),
    );

    const result = await service.listConversations(workspaceId, userId);
    expect(result).toHaveLength(1);
  });
});
