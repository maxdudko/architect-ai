export class UnparseableFileError extends Error {
  readonly code = 'UNPARSEABLE_FILE';

  constructor(
    readonly relativePath: string,
    cause?: unknown,
  ) {
    const reason =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'unknown parse error';
    super(`Unable to parse ${relativePath}: ${reason}`);
    this.name = 'UnparseableFileError';
  }
}

export function isUnparseableFileError(
  error: unknown,
): error is UnparseableFileError {
  return (
    error instanceof UnparseableFileError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'UNPARSEABLE_FILE')
  );
}
