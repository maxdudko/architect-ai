import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MessageRole,
  RepositoryStatus,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';
import { UsageLimitExceededException } from '../../../usage/usage-limit.exception';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import { ArchitectureSearchService } from './architecture-search.service';

const WORKSPACE_ID = 'workspace-1';
const REPOSITORY_ID = 'repo-1';
const USER_ID = 'user-1';
const RUN_ID = 'run-1';

function graph(overrides: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    repositoryId: REPOSITORY_ID,
    indexingRunId: RUN_ID,
    modules: [
      {
        key: 'src/billing',
        name: 'Billing',
        path: 'src/billing',
        fileCount: 2,
        symbolCount: 2,
        languages: ['typescript'],
        outgoingDependencyCount: 0,
        incomingDependencyCount: 1,
        internalRelationCount: 0,
        unresolvedRelationCount: 0,
        externalRelationCount: 0,
        significance: 5,
      },
      {
        key: 'src/features',
        name: 'Features',
        path: 'src/features',
        fileCount: 2,
        symbolCount: 2,
        languages: ['typescript'],
        outgoingDependencyCount: 1,
        incomingDependencyCount: 0,
        internalRelationCount: 0,
        unresolvedRelationCount: 0,
        externalRelationCount: 0,
        significance: 5,
      },
    ],
    filePathsByModule: {
      'src/billing': ['src/billing/invoice.ts', 'src/billing/tax.ts'],
      'src/features': ['src/features/checkout.ts', 'src/features/auth.ts'],
    },
    dependencies: [
      {
        fromModuleKey: 'src/features',
        toModuleKey: 'src/billing',
        relationTypes: ['IMPORTS'],
        supportingRelationCount: 1,
        confidence: 'RESOLVED',
        evidence: [
          {
            sourceFilePath: 'src/features/checkout.ts',
            targetFilePath: 'src/billing/invoice.ts',
            relationType: 'IMPORTS',
            observedTarget: '../billing/invoice',
            targetName: 'invoice',
            strategy: 'RELATIVE_PATH',
          },
        ],
        evidenceTruncated: false,
      },
    ],
    unresolved: [],
    external: [],
    exclusions: [],
    nonDependencyRelationCounts: [],
    totals: {
      moduleCount: 2,
      dependencyCount: 1,
      resolvedRelationCount: 1,
      unresolvedRelationCount: 0,
      externalRelationCount: 0,
      internalRelationCount: 0,
      groupedFileCount: 4,
      excludedFileCount: 0,
    },
    partial: false,
    partialReasons: [],
    ...overrides,
  };
}

describe('ArchitectureSearchService', () => {
  const dataSource = {
    findRepositoryInWorkspace: jest.fn(),
    findLatestSucceededRevision: jest.fn(),
  };
  const graphProvider = { getGraph: jest.fn() };
  const conversationsRepository = {
    findArchitectureThread: jest.fn(),
    findOrCreateArchitectureThread: jest.fn(),
    createMessage: jest.fn(),
    touchUpdatedAt: jest.fn(),
    listMessages: jest.fn(),
  };
  const usageService = { assertWithinLimit: jest.fn() };
  const generate = jest.fn();
  const workspaceLlmResolver = {
    resolve: jest.fn().mockResolvedValue({
      name: 'mock',
      generate,
      stream: function* stream() {
        yield { type: 'token' as const, text: 'streamed' };
        yield { type: 'done' as const, content: 'streamed', model: 'mock' };
      },
    }),
  };
  const retrievalService = { retrieve: jest.fn() };
  const analyticsService = { recordSourceCitations: jest.fn() };
  const answerFeedbackService = { listRatingsForUser: jest.fn() };

  const service = new ArchitectureSearchService(
    dataSource as never,
    graphProvider as never,
    conversationsRepository as never,
    usageService as never,
    workspaceLlmResolver as never,
    retrievalService as never,
    analyticsService as never,
    answerFeedbackService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.findRepositoryInWorkspace.mockResolvedValue({
      id: REPOSITORY_ID,
      status: RepositoryStatus.READY,
      fullName: 'acme/platform',
    });
    dataSource.findLatestSucceededRevision.mockResolvedValue({
      indexingRunId: RUN_ID,
      branch: 'main',
      commitSha: 'abc123',
      completedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    usageService.assertWithinLimit.mockResolvedValue(undefined);
    conversationsRepository.findOrCreateArchitectureThread.mockResolvedValue({
      id: 'conversation-1',
    });
    conversationsRepository.createMessage.mockImplementation(
      (input: { role: MessageRole; content: string }) => ({
        id:
          input.role === MessageRole.USER
            ? 'user-message'
            : 'assistant-message',
        conversationId: 'conversation-1',
        role: input.role,
        content: input.content,
        metadata: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    );
    conversationsRepository.touchUpdatedAt.mockResolvedValue(undefined);
    graphProvider.getGraph.mockResolvedValue(graph());
    retrievalService.retrieve.mockResolvedValue({
      chunks: [],
      symbols: [],
      files: [],
      references: [],
    });
    analyticsService.recordSourceCitations.mockResolvedValue([]);
  });

  it('refuses a repository that has never finished indexing before writing a message', async () => {
    dataSource.findLatestSucceededRevision.mockResolvedValue(null);

    await expect(
      service.ask(
        WORKSPACE_ID,
        REPOSITORY_ID,
        USER_ID,
        'What depends on Billing?',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(usageService.assertWithinLimit).not.toHaveBeenCalled();
    expect(conversationsRepository.createMessage).not.toHaveBeenCalled();
  });

  it('checks the question quota before creating a message', async () => {
    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.AI_QUESTIONS,
        used: 10,
        limit: 10,
        period: UsagePeriod.MONTHLY,
      }),
    );

    await expect(
      service.ask(
        WORKSPACE_ID,
        REPOSITORY_ID,
        USER_ID,
        'What depends on Billing?',
      ),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);

    expect(usageService.assertWithinLimit).toHaveBeenCalledWith(
      WORKSPACE_ID,
      UsageMetric.AI_QUESTIONS,
    );
    expect(conversationsRepository.createMessage).not.toHaveBeenCalled();
  });

  it('hides a repository that belongs to another workspace', async () => {
    dataSource.findRepositoryInWorkspace.mockResolvedValue(null);

    await expect(
      service.ask(
        WORKSPACE_ID,
        REPOSITORY_ID,
        USER_ID,
        'What depends on Billing?',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(graphProvider.getGraph).not.toHaveBeenCalled();
  });

  it('answers a dependent question from the dependency graph for the selected revision', async () => {
    generate.mockImplementation(
      (request: { messages: Array<{ content: string }> }) => {
        const text = request.messages
          .map((message) => message.content)
          .join('\n');
        if (text.includes('architecture-search-classify')) {
          return {
            content: JSON.stringify({
              intent: 'DEPENDENTS_OF',
              entities: ['Billing'],
            }),
            model: 'mock',
          };
        }
        return { content: 'Features imports Billing.', model: 'mock' };
      },
    );

    const answer = await service.ask(
      WORKSPACE_ID,
      REPOSITORY_ID,
      USER_ID,
      'What depends on Billing?',
    );

    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        repositoryIds: [REPOSITORY_ID],
        indexingRunIds: [RUN_ID],
        topK: 8,
      }),
    );
    expect(answer.revision.indexingRunId).toBe(RUN_ID);
    expect(answer.intent).toBe('DEPENDENTS_OF');
    expect(answer.epistemic).toBe('OBSERVED');
    expect(answer.findings).toEqual([
      expect.objectContaining({
        direction: 'DEPENDENT',
        relatedModuleKey: 'src/features',
        supportingRelationCount: 1,
        confidence: 'RESOLVED',
      }),
    ]);
    expect(answer.findings[0]?.evidence[0]?.filePath).toBe(
      'src/features/checkout.ts',
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('does not generate an answer when the module name is ambiguous', async () => {
    graphProvider.getGraph.mockResolvedValue(
      graph({
        modules: [
          {
            key: 'src/shared',
            name: 'Shared',
            path: 'src/shared',
            fileCount: 2,
            symbolCount: 1,
            languages: ['typescript'],
            outgoingDependencyCount: 0,
            incomingDependencyCount: 0,
            internalRelationCount: 0,
            unresolvedRelationCount: 0,
            externalRelationCount: 0,
            significance: 3,
          },
          {
            key: 'lib/shared',
            name: 'Shared',
            path: 'lib/shared',
            fileCount: 2,
            symbolCount: 1,
            languages: ['typescript'],
            outgoingDependencyCount: 0,
            incomingDependencyCount: 0,
            internalRelationCount: 0,
            unresolvedRelationCount: 0,
            externalRelationCount: 0,
            significance: 3,
          },
        ],
        dependencies: [],
      }),
    );
    generate.mockResolvedValue({
      content: JSON.stringify({
        intent: 'DEPENDENTS_OF',
        entities: ['shared'],
      }),
      model: 'mock',
    });

    const answer = await service.ask(
      WORKSPACE_ID,
      REPOSITORY_ID,
      USER_ID,
      'What depends on shared?',
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(answer.entityResolution.outcome).toBe('AMBIGUOUS');
    expect(answer.findings).toEqual([]);
    expect(answer.content).toContain('src/shared');
    expect(answer.content).toContain('lib/shared');
    expect(answer.epistemic).toBe('NOT_ESTABLISHABLE');
  });
});
