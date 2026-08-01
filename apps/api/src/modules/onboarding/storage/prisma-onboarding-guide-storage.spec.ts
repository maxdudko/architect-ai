import { GuideType, RepositoryStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaOnboardingGuideStorage } from './prisma-onboarding-guide-storage';

describe('PrismaOnboardingGuideStorage', () => {
  let prisma: {
    repository: { findFirst: jest.Mock };
    guide: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    guideGenerationRun: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let storage: PrismaOnboardingGuideStorage;

  beforeEach(() => {
    prisma = {
      repository: {
        findFirst: jest.fn().mockResolvedValue({ id: 'repository-1' }),
      },
      guide: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      guideGenerationRun: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    storage = new PrismaOnboardingGuideStorage(
      prisma as unknown as PrismaService,
    );
  });

  it('scopes list and search to workspace and repository', async () => {
    await storage.listGuides('workspace-1', 'repository-1', {
      types: [GuideType.MODULE],
      slugs: ['billing'],
      search: '  Payments  ',
    });

    expect(prisma.repository.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'repository-1',
        workspaceId: 'workspace-1',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.guide.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        type: { in: [GuideType.MODULE] },
        slug: { in: ['billing'] },
        OR: [
          { title: { contains: 'Payments', mode: 'insensitive' } },
          { slug: { contains: 'Payments', mode: 'insensitive' } },
          { summary: { contains: 'Payments', mode: 'insensitive' } },
          { markdown: { contains: 'Payments', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ type: 'asc' }, { slug: 'asc' }],
    });
  });

  it('scopes guide lookup and returns null without cross-repository fallback', async () => {
    await expect(
      storage.getGuide('workspace-1', 'repository-1', 'guide-1'),
    ).resolves.toBeNull();

    expect(prisma.guide.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'guide-1',
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
      },
    });
  });

  it('rejects missing, deleted, or cross-workspace repositories', async () => {
    prisma.repository.findFirst.mockResolvedValue(null);

    await expect(
      storage.listGuides('other-workspace', 'repository-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guide.findMany).not.toHaveBeenCalled();
  });

  it('requires READY status before generation', async () => {
    prisma.repository.findFirst.mockResolvedValue({
      status: RepositoryStatus.PARSING,
    });

    await expect(
      storage.validateRepositoryReady('workspace-1', 'repository-1'),
    ).rejects.toThrow('must be READY');
    expect(prisma.repository.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'repository-1',
        workspaceId: 'workspace-1',
        deletedAt: null,
      },
      select: { status: true },
    });
  });

  it('atomically upserts replacements, increments versions, and deletes stale keys', async () => {
    const guides = [
      {
        type: GuideType.MODULE,
        slug: 'billing',
        title: 'Billing Module',
        markdown: '# Billing',
        summary: 'Billing',
        metadata: { target: 'billing' },
      },
      {
        type: GuideType.MODULE,
        slug: 'users',
        title: 'Users Module',
        markdown: '# Users',
        summary: null,
        metadata: { target: 'users' },
      },
    ];
    prisma.guide.findMany.mockResolvedValue([{ id: 'guide-1' }]);

    const output = await storage.replaceGuideSet({
      workspaceId: 'workspace-1',
      repositoryId: 'repository-1',
      replacedTypes: [GuideType.MODULE],
      guides,
      sourceIndexingRunId: 'index-run-2',
      sourceCommitSha: 'sha-2',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.guide.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.guide.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId_type_slug: {
            repositoryId: 'repository-1',
            type: GuideType.MODULE,
            slug: 'billing',
          },
        },
        update: expect.objectContaining({
          generationVersion: { increment: 1 },
          sourceIndexingRunId: 'index-run-2',
          sourceCommitSha: 'sha-2',
        }),
      }),
    );
    expect(prisma.guide.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        type: { in: [GuideType.MODULE] },
        NOT: {
          OR: [
            { type: GuideType.MODULE, slug: 'billing' },
            { type: GuideType.MODULE, slug: 'users' },
          ],
        },
      },
    });
    expect(prisma.guide.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        type: { in: [GuideType.MODULE] },
      },
      orderBy: [{ type: 'asc' }, { slug: 'asc' }],
    });
    expect(output).toEqual([{ id: 'guide-1' }]);
  });

  it('deletes every stale guide for an empty replacement type', async () => {
    await storage.replaceGuideSet({
      workspaceId: 'workspace-1',
      repositoryId: 'repository-1',
      replacedTypes: [GuideType.SERVICE],
      guides: [],
    });

    expect(prisma.guide.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        type: { in: [GuideType.SERVICE] },
      },
    });
  });

  it('validates replacement identities before opening a transaction', () => {
    expect(() =>
      storage.replaceGuideSet({
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        replacedTypes: [GuideType.MODULE],
        guides: [
          {
            type: GuideType.SERVICE,
            slug: 'wrong',
            title: 'Wrong',
            markdown: '# Wrong',
            metadata: {},
          },
        ],
      }),
    ).toThrow('is not included in replacedTypes');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    expect(() =>
      storage.replaceGuideSet({
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        replacedTypes: [GuideType.MODULE],
        guides: [
          {
            type: GuideType.MODULE,
            slug: 'duplicate',
            title: 'First',
            markdown: '# First',
            metadata: {},
          },
          {
            type: GuideType.MODULE,
            slug: 'duplicate',
            title: 'Second',
            markdown: '# Second',
            metadata: {},
          },
        ],
      }),
    ).toThrow('Duplicate guide identity');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
