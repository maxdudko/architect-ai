import { Injectable, NotFoundException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { IndexingResourceMetric } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
  IndexingResourceLimitError,
} from './indexing-resource-limit.error';
import { INDEXING_RESOURCE_METRICS } from './plan-indexing-limit.defaults';

export interface IndexingResourceLimitSnapshot {
  metric: IndexingResourceMetric;
  maxValue: number | null;
}

export type IndexingResourceLimits = Record<
  IndexingResourceMetric,
  number | null
>;

@Injectable()
export class IndexingResourceLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async getLimitsForPlan(
    planId: string,
  ): Promise<IndexingResourceLimitSnapshot[]> {
    const rows = await this.prisma.planIndexingLimit.findMany({
      where: { planId },
    });
    const byMetric = new Map(rows.map((row) => [row.metric, row.maxValue]));
    return INDEXING_RESOURCE_METRICS.map((metric) => ({
      metric,
      maxValue: toNumberLimit(byMetric.get(metric) ?? null),
    }));
  }

  async getLimitsForWorkspace(
    workspaceId: string,
  ): Promise<IndexingResourceLimits> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { planId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const snapshots = await this.getLimitsForPlan(workspace.planId);
    const limits = {} as IndexingResourceLimits;
    for (const snapshot of snapshots) {
      limits[snapshot.metric] = snapshot.maxValue;
    }
    return limits;
  }

  async assertWithin(
    workspaceId: string,
    metric: IndexingResourceMetric,
    used: number,
  ): Promise<void> {
    const limits = await this.getLimitsForWorkspace(workspaceId);
    this.assertAgainstLimit(metric, used, limits[metric]);
  }

  assertAgainstLimit(
    metric: IndexingResourceMetric,
    used: number,
    limit: number | null | undefined,
  ): void {
    if (limit == null) {
      return;
    }
    if (used > limit) {
      throw this.createExceededError(metric, used, limit);
    }
  }

  createExceededError(
    metric: IndexingResourceMetric,
    used: number,
    limit: number,
  ): IndexingResourceLimitError {
    return new IndexingResourceLimitError(
      metric,
      used,
      limit,
      formatResourceLimitMessage(metric, used, limit),
    );
  }

  toUnrecoverableError(error: IndexingResourceLimitError): UnrecoverableError {
    const wrapped = new UnrecoverableError(error.message);
    Object.assign(wrapped, {
      resourceLimit: {
        code: INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
        metric: error.metric,
        used: error.used,
        limit: error.limit,
      },
    });
    return wrapped;
  }
}

export function toNumberLimit(
  value: bigint | number | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  return Number(value);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${trimNumber(gb)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${trimNumber(mb)} MB`;
  }
  if (bytes >= 1024) {
    const kb = bytes / 1024;
    return `${trimNumber(kb)} KB`;
  }
  return `${bytes} B`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '');
}

export function formatResourceLimitMessage(
  metric: IndexingResourceMetric,
  used: number,
  limit: number,
): string {
  switch (metric) {
    case IndexingResourceMetric.REPOSITORY_SIZE_BYTES:
      return `This repository exceeds the plan size limit (${formatBytes(used)} used / ${formatBytes(limit)} max). Upgrade or connect a smaller repository.`;
    case IndexingResourceMetric.INDEXABLE_FILES:
      return `This repository exceeds the plan indexable file limit (${used.toLocaleString()} files / ${limit.toLocaleString()} max). Upgrade or connect a smaller repository.`;
    case IndexingResourceMetric.INDEXED_TOKENS:
      return `This repository exceeds the plan indexed token limit (${used.toLocaleString()} tokens / ${limit.toLocaleString()} max). Upgrade or connect a smaller repository.`;
    case IndexingResourceMetric.EMBEDDING_CHUNKS:
      return `This repository exceeds the plan embedding chunk limit (${used.toLocaleString()} chunks / ${limit.toLocaleString()} max). Upgrade or connect a smaller repository.`;
    case IndexingResourceMetric.FILE_SIZE_BYTES:
      return `This repository contains a file larger than the plan file size limit (${formatBytes(used)} / ${formatBytes(limit)} max). Upgrade or connect a smaller repository.`;
    default:
      return `This repository exceeds a plan indexing limit (${used.toLocaleString()} used / ${limit.toLocaleString()} max). Upgrade or connect a smaller repository.`;
  }
}
