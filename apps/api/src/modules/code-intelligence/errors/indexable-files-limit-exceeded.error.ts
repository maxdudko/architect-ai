export class IndexableFilesLimitExceededError extends Error {
  constructor(
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(`Indexable file count ${used} exceeds the plan limit of ${limit}`);
    this.name = 'IndexableFilesLimitExceededError';
  }
}

export function isIndexableFilesLimitExceededError(
  error: unknown,
): error is IndexableFilesLimitExceededError {
  return error instanceof IndexableFilesLimitExceededError;
}
