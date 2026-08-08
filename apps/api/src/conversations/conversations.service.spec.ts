import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
      assertUserCanAccessRepository: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RepositoryAccessValidationService>;

    service = new ConversationsService(
      conversationsRepository,
      repositoryAccessValidationService,
    );
  });

  it('asserts repository access when creating a conversation with a repository', async () => {
    conversationsRepository.create.mockResolvedValue(baseConversation);

    await service.createConversation(workspaceId, userId, {
      repositoryId,
      title: 'Auth flow',
    });

    expect(
      repositoryAccessValidationService.assertUserCanAccessRepository,
    ).toHaveBeenCalledWith({
      workspaceId,
      repositoryId,
      userId,
    });
    expect(conversationsRepository.create).toHaveBeenCalled();
  });

  it('forbids getting a conversation when the user cannot access its repository', async () => {
    conversationsRepository.findByIdWithMessages.mockResolvedValue({
      ...baseConversation,
      messages: [],
    });
    repositoryAccessValidationService.assertUserCanAccessRepository.mockRejectedValue(
      new ForbiddenException(
        'Your GitHub account no longer has access to this repository. Reconnect GitHub or request access.',
      ),
    );

    await expect(
      service.getConversation(workspaceId, conversationId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters inaccessible repository conversations from the list', async () => {
    const accessibleConversation = {
      ...baseConversation,
      id: 'conversation-accessible',
      repositoryId: 'repo-accessible',
    };
    const inaccessibleConversation = {
      ...baseConversation,
      id: 'conversation-inaccessible',
      repositoryId: 'repo-inaccessible',
    };
    const workspaceOnlyConversation = {
      ...baseConversation,
      id: 'conversation-workspace',
      repositoryId: null,
    };

    conversationsRepository.listByWorkspace.mockResolvedValue([
      accessibleConversation,
      inaccessibleConversation,
      workspaceOnlyConversation,
    ]);
    repositoryAccessValidationService.assertUserCanAccessRepository.mockImplementation(
      (params) => {
        if (params.repositoryId === 'repo-inaccessible') {
          return Promise.reject(
            new ForbiddenException(
              'Your GitHub account no longer has access to this repository. Reconnect GitHub or request access.',
            ),
          );
        }
        return Promise.resolve();
      },
    );

    const result = await service.listConversations(workspaceId, userId);

    expect(result.map((conversation) => conversation.id)).toEqual([
      'conversation-accessible',
      'conversation-workspace',
    ]);
  });

  it('rethrows non-forbidden errors while resolving list access', async () => {
    conversationsRepository.listByWorkspace.mockResolvedValue([
      baseConversation,
    ]);
    repositoryAccessValidationService.assertUserCanAccessRepository.mockRejectedValue(
      new NotFoundException('Repository not found in this workspace'),
    );

    await expect(
      service.listConversations(workspaceId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
