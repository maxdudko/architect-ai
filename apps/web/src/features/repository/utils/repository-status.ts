import type { RepositoryStatus } from '@/entities';

const ACTIVE_INDEXING_STATUSES: ReadonlySet<RepositoryStatus> = new Set([
  'PENDING',
  'CLONING',
  'PARSING',
  'CHUNKING',
  'EMBEDDING',
]);

export function isRepositoryIndexingActive(status: RepositoryStatus): boolean {
  return ACTIVE_INDEXING_STATUSES.has(status);
}

export function getRepositoryStatusLabel(status: RepositoryStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'CLONING':
      return 'Cloning';
    case 'PARSING':
      return 'Parsing';
    case 'CHUNKING':
      return 'Chunking';
    case 'EMBEDDING':
      return 'Embedding';
    case 'READY':
      return 'Ready';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

export function getRepositoryActionVisibility(
  status: RepositoryStatus,
  canManage: boolean,
): {
  showRetry: boolean;
  showReindex: boolean;
  allowDisconnect: boolean;
} {
  if (!canManage) {
    return {
      showRetry: false,
      showReindex: false,
      allowDisconnect: false,
    };
  }

  return {
    showRetry: status === 'FAILED' || status === 'PENDING',
    showReindex: status === 'READY',
    allowDisconnect:
      !isRepositoryIndexingActive(status) || status === 'PENDING',
  };
}
