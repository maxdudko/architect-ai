import { IndexingResourceMetric } from '@prisma/client';

export const INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE =
  'INDEXING_RESOURCE_LIMIT_EXCEEDED';

export class IndexingResourceLimitError extends Error {
  readonly code = INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE;

  constructor(
    public readonly metric: IndexingResourceMetric,
    public readonly used: number,
    public readonly limit: number,
    message: string,
  ) {
    super(message);
    this.name = 'IndexingResourceLimitError';
  }
}

export function isIndexingResourceLimitError(
  error: unknown,
): error is IndexingResourceLimitError {
  return error instanceof IndexingResourceLimitError;
}

export function getIndexingResourceLimitPayload(error: unknown): {
  code: typeof INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE;
  metric: IndexingResourceMetric;
  used: number;
  limit: number;
  message: string;
} | null {
  if (isIndexingResourceLimitError(error)) {
    return {
      code: error.code,
      metric: error.metric,
      used: error.used,
      limit: error.limit,
      message: error.message,
    };
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'resourceLimit' in error &&
    typeof (error as { resourceLimit?: unknown }).resourceLimit === 'object' &&
    (error as { resourceLimit?: { code?: unknown } }).resourceLimit !== null
  ) {
    const payload = (
      error as {
        resourceLimit: {
          code?: unknown;
          metric?: unknown;
          used?: unknown;
          limit?: unknown;
        };
      }
    ).resourceLimit;
    if (
      payload.code === INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE &&
      typeof payload.metric === 'string' &&
      typeof payload.used === 'number' &&
      typeof payload.limit === 'number'
    ) {
      return {
        code: INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
        metric: payload.metric as IndexingResourceMetric,
        used: payload.used,
        limit: payload.limit,
        message:
          error instanceof Error
            ? error.message
            : 'Indexing resource limit exceeded',
      };
    }
  }
  return null;
}
