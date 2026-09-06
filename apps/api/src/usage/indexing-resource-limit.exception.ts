import { ForbiddenException } from '@nestjs/common';
import { IndexingResourceMetric } from '@prisma/client';
import {
  INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
  IndexingResourceLimitError,
} from './indexing-resource-limit.error';

export interface IndexingResourceLimitExceededBody {
  code: typeof INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE;
  message: string;
  metric: IndexingResourceMetric;
  used: number;
  limit: number;
}

export class IndexingResourceLimitExceededException extends ForbiddenException {
  constructor(error: IndexingResourceLimitError) {
    const body: IndexingResourceLimitExceededBody = {
      code: INDEXING_RESOURCE_LIMIT_EXCEEDED_CODE,
      message: error.message,
      metric: error.metric,
      used: error.used,
      limit: error.limit,
    };
    super(body);
  }
}
