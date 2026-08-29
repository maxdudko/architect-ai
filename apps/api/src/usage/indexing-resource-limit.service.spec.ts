import { IndexingResourceMetric } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import { IndexingResourceLimitError } from './indexing-resource-limit.error';
import { IndexingResourceLimitService } from './indexing-resource-limit.service';

describe('IndexingResourceLimitService', () => {
  const workspaceId = 'workspace-1';
  const planId = 'plan-free';
  let prisma: {
    workspace: { findFirst: jest.Mock };
    planIndexingLimit: { findMany: jest.Mock };
  };
  let service: IndexingResourceLimitService;

  beforeEach(() => {
    prisma = {
      workspace: { findFirst: jest.fn() },
      planIndexingLimit: { findMany: jest.fn() },
    };
    service = new IndexingResourceLimitService(prisma as never);
  });

  it('treats a missing maxValue as unlimited', () => {
    expect(() =>
      service.assertAgainstLimit(
        IndexingResourceMetric.INDEXABLE_FILES,
        50_000,
        null,
      ),
    ).not.toThrow();
  });

  it('throws when used exceeds the cap', () => {
    expect(() =>
      service.assertAgainstLimit(
        IndexingResourceMetric.EMBEDDING_CHUNKS,
        15_001,
        15_000,
      ),
    ).toThrow(IndexingResourceLimitError);
  });

  it('allows used equal to the cap', () => {
    expect(() =>
      service.assertAgainstLimit(
        IndexingResourceMetric.INDEXABLE_FILES,
        10_000,
        10_000,
      ),
    ).not.toThrow();
  });

  it('loads workspace plan limits at enforcement time', async () => {
    prisma.workspace.findFirst.mockResolvedValue({ planId });
    prisma.planIndexingLimit.findMany.mockResolvedValue([
      {
        metric: IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
        maxValue: 262144000n,
      },
    ]);

    await expect(
      service.assertWithin(
        workspaceId,
        IndexingResourceMetric.REPOSITORY_SIZE_BYTES,
        300_000_000,
      ),
    ).rejects.toBeInstanceOf(IndexingResourceLimitError);
  });

  it('wraps exceeded errors as BullMQ UnrecoverableError', () => {
    const error = service.createExceededError(
      IndexingResourceMetric.INDEXED_TOKENS,
      2_000_001,
      2_000_000,
    );
    const wrapped = service.toUnrecoverableError(error);
    expect(wrapped).toBeInstanceOf(UnrecoverableError);
    expect(wrapped.message).toContain('indexed token');
    expect(
      (wrapped as UnrecoverableError & { resourceLimit?: { code?: string } })
        .resourceLimit?.code,
    ).toBe('INDEXING_RESOURCE_LIMIT_EXCEEDED');
  });
});
