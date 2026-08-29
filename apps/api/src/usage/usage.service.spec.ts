import {
  MembershipStatus,
  MessageRole,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';
import { UsageLimitExceededException } from './usage-limit.exception';
import { UsageService } from './usage.service';

const FREE_PLAN_ID = 'plan-free';
const PRO_PLAN_ID = 'plan-pro';
const ENTERPRISE_PLAN_ID = 'plan-enterprise';

describe('UsageService', () => {
  const workspaceId = 'workspace-1';
  let prisma: {
    workspace: { findFirst: jest.Mock };
    planLimit: { findMany: jest.Mock; findUnique: jest.Mock };
    planIndexingLimit: { findMany: jest.Mock };
    repository: { count: jest.Mock };
    indexingRun: { count: jest.Mock };
    guideGenerationRun: { count: jest.Mock };
    message: { count: jest.Mock };
    membership: { count: jest.Mock };
    invitation: { count: jest.Mock };
  };
  let service: UsageService;

  beforeEach(() => {
    prisma = {
      workspace: { findFirst: jest.fn() },
      planLimit: { findMany: jest.fn(), findUnique: jest.fn() },
      planIndexingLimit: { findMany: jest.fn().mockResolvedValue([]) },
      repository: { count: jest.fn() },
      indexingRun: { count: jest.fn() },
      guideGenerationRun: { count: jest.fn() },
      message: { count: jest.fn() },
      membership: { count: jest.fn() },
      invitation: { count: jest.fn() },
    };
    service = new UsageService(prisma as never);
  });

  it('treats a missing plan limit row as unlimited', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: PRO_PLAN_ID,
    });
    prisma.planLimit.findUnique.mockResolvedValue(null);
    prisma.message.count.mockResolvedValue(12);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.AI_QUESTIONS),
    ).resolves.toBeUndefined();
  });

  it('treats a null maxValue as unlimited', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: ENTERPRISE_PLAN_ID,
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.AI_QUESTIONS,
      period: UsagePeriod.MONTHLY,
      maxValue: null,
    });
    prisma.message.count.mockResolvedValue(999);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.AI_QUESTIONS),
    ).resolves.toBeUndefined();
  });

  it('throws when used meets the limit', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.AI_QUESTIONS,
      period: UsagePeriod.MONTHLY,
      maxValue: 50,
    });
    prisma.message.count.mockResolvedValue(50);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.AI_QUESTIONS),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(prisma.message.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: MessageRole.USER,
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('counts only active members and ignores pending invitations', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.MEMBERS,
      period: UsagePeriod.CURRENT,
      maxValue: 3,
    });
    prisma.membership.count.mockResolvedValue(2);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.MEMBERS),
    ).resolves.toBeUndefined();
    expect(prisma.membership.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MembershipStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.invitation.count).not.toHaveBeenCalled();
  });

  it('throws when active members meet the workspace members limit', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.MEMBERS,
      period: UsagePeriod.CURRENT,
      maxValue: 3,
    });
    prisma.membership.count.mockResolvedValue(3);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.MEMBERS),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(prisma.invitation.count).not.toHaveBeenCalled();
  });

  it('treats AI questions as unlimited when BYOK is active', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
      aiSettings: { activeProvider: 'OPENAI' },
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.AI_QUESTIONS,
      period: UsagePeriod.MONTHLY,
      maxValue: 50,
    });
    prisma.message.count.mockResolvedValue(50);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.AI_QUESTIONS),
    ).resolves.toBeUndefined();
  });

  it('treats onboarding guides as unlimited when BYOK is active', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
      aiSettings: { activeProvider: 'OPENAI' },
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.GUIDE_GENERATIONS,
      period: UsagePeriod.MONTHLY,
      maxValue: 3,
    });
    prisma.guideGenerationRun.count.mockResolvedValue(3);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.GUIDE_GENERATIONS),
    ).resolves.toBeUndefined();
  });

  it('still enforces repository limits when BYOK is active', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      planId: FREE_PLAN_ID,
      aiSettings: { activeProvider: 'OPENAI' },
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      metric: UsageMetric.REPOSITORIES,
      period: UsagePeriod.CURRENT,
      maxValue: 1,
    });
    prisma.repository.count.mockResolvedValue(1);

    await expect(
      service.assertWithinLimit(workspaceId, UsageMetric.REPOSITORIES),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
  });

  it('reports BYOK-uncapped metrics in the usage snapshot', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: workspaceId,
      plan: { id: FREE_PLAN_ID, key: 'free', name: 'Free' },
      aiSettings: { activeProvider: 'OPENAI' },
    });
    prisma.planLimit.findMany.mockResolvedValue([
      {
        metric: UsageMetric.REPOSITORIES,
        period: UsagePeriod.CURRENT,
        maxValue: 1,
      },
      {
        metric: UsageMetric.INDEXING_RUNS,
        period: UsagePeriod.MONTHLY,
        maxValue: 5,
      },
      {
        metric: UsageMetric.GUIDE_GENERATIONS,
        period: UsagePeriod.MONTHLY,
        maxValue: 3,
      },
      {
        metric: UsageMetric.AI_QUESTIONS,
        period: UsagePeriod.MONTHLY,
        maxValue: 50,
      },
      {
        metric: UsageMetric.MEMBERS,
        period: UsagePeriod.CURRENT,
        maxValue: 3,
      },
    ]);
    prisma.repository.count.mockResolvedValue(1);
    prisma.indexingRun.count.mockResolvedValue(2);
    prisma.guideGenerationRun.count.mockResolvedValue(3);
    prisma.message.count.mockResolvedValue(50);
    prisma.membership.count.mockResolvedValue(1);
    prisma.invitation.count.mockResolvedValue(0);

    const snapshot = await service.getWorkspaceUsage(workspaceId);

    expect(snapshot.aiMode).toBe('BYOK');
    expect(snapshot.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: UsageMetric.AI_QUESTIONS,
          used: 50,
          limit: null,
          remaining: null,
        }),
        expect.objectContaining({
          metric: UsageMetric.GUIDE_GENERATIONS,
          used: 3,
          limit: null,
          remaining: null,
        }),
        expect.objectContaining({
          metric: UsageMetric.REPOSITORIES,
          used: 1,
          limit: 1,
          remaining: 0,
        }),
      ]),
    );
  });
});
