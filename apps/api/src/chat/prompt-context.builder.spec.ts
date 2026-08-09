import {
  MessageRole,
  RepositoryStatus,
  RepositoryProvider,
} from '@prisma/client';
import type { RetrievedContext } from '../modules/retrieval/types/retrieved-context.type';
import { PromptContextBuilder } from './prompt-context.builder';

describe('PromptContextBuilder', () => {
  const builder = new PromptContextBuilder();

  it('assembles system, repository, sources, history, and question', () => {
    const retrievedContext: RetrievedContext = {
      chunks: [
        {
          id: 'chunk-1',
          repositoryId: 'repo-1',
          fileId: 'file-1',
          symbolId: null,
          filePath: 'src/auth.service.ts',
          content: 'export class AuthService {}',
          tokenCount: 10,
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          symbolName: 'AuthService',
          qualifiedName: 'AuthService',
          symbolType: 'class',
          score: 0.9,
        },
      ],
      symbols: [],
      files: [],
      references: [
        {
          chunkId: 'chunk-1',
          repositoryId: 'repo-1',
          filePath: 'src/auth.service.ts',
          symbolName: 'AuthService',
          qualifiedName: 'AuthService',
          startLine: 1,
          endLine: 3,
          score: 0.9,
        },
      ],
    };

    const messages = builder.build({
      question: 'How does authentication work?',
      repository: {
        id: 'repo-1',
        workspaceId: 'ws-1',
        provider: RepositoryProvider.GITHUB,
        externalId: '1',
        owner: 'acme',
        name: 'api',
        fullName: 'acme/api',
        defaultBranch: 'main',
        status: RepositoryStatus.READY,
        lastIndexedAt: null,
        indexingError: null,
        connectedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      retrievedContext,
      history: [
        {
          id: 'm1',
          conversationId: 'c1',
          role: MessageRole.USER,
          content: 'Hi',
          metadata: null,
          createdAt: new Date('2026-07-24T00:00:00.000Z'),
        },
        {
          id: 'm2',
          conversationId: 'c1',
          role: MessageRole.ASSISTANT,
          content: 'Hello',
          metadata: null,
          createdAt: new Date('2026-07-24T00:00:01.000Z'),
        },
      ],
    });

    expect(messages[0]?.role).toBe('system');
    expect(
      messages.some((message) => message.content.includes('acme/api')),
    ).toBe(true);
    expect(
      messages.some((message) =>
        message.content.includes('src/auth.service.ts'),
      ),
    ).toBe(true);
    expect(messages.at(-1)).toEqual({
      role: 'user',
      content: 'How does authentication work?',
    });
  });
});
