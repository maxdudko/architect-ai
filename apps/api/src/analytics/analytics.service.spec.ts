import { AnalyticsEventType } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const prisma = {
    analyticsEvent: {
      create: jest.fn(),
    },
    messageSourceCitation: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const service = new AnalyticsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records analytics events', async () => {
    prisma.analyticsEvent.create.mockResolvedValue({
      id: 'evt-1',
      type: AnalyticsEventType.REPOSITORY_CONNECTED,
    });

    await service.recordEvent({
      type: AnalyticsEventType.REPOSITORY_CONNECTED,
      workspaceId: 'ws-1',
      actorUserId: 'user-1',
      repositoryId: 'repo-1',
      payload: { fullName: 'acme/api' },
    });

    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AnalyticsEventType.REPOSITORY_CONNECTED,
        workspaceId: 'ws-1',
        actorUserId: 'user-1',
        repositoryId: 'repo-1',
      }),
    });
  });

  it('records source citations with rank', async () => {
    prisma.messageSourceCitation.createMany.mockResolvedValue({ count: 1 });
    prisma.messageSourceCitation.findMany.mockResolvedValue([]);

    await service.recordSourceCitations({
      messageId: 'msg-1',
      workspaceId: 'ws-1',
      sources: [
        {
          chunkId: 'chunk-1',
          repositoryId: 'repo-1',
          filePath: 'src/app.ts',
          symbolName: null,
          qualifiedName: null,
          startLine: 1,
          endLine: 10,
          score: 0.9,
        },
      ],
    });

    expect(prisma.messageSourceCitation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          messageId: 'msg-1',
          workspaceId: 'ws-1',
          chunkId: 'chunk-1',
          rank: 0,
        }),
      ],
    });
  });
});
