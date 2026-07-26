import type { Repository } from '@/entities';
import { isRepositoryIndexingActive } from '@/features/repository/utils/repository-status';

export interface RepositoryStatusSummary {
  ready: number;
  indexing: number;
  failed: number;
}

export function summarizeRepositoryStatuses(repositories: Repository[]): RepositoryStatusSummary {
  const summary: RepositoryStatusSummary = { ready: 0, indexing: 0, failed: 0 };

  for (const repository of repositories) {
    if (repository.status === 'READY') {
      summary.ready += 1;
    } else if (repository.status === 'FAILED') {
      summary.failed += 1;
    } else if (isRepositoryIndexingActive(repository.status)) {
      summary.indexing += 1;
    }
  }

  return summary;
}

export function formatRepositoryStatusSummary(summary: RepositoryStatusSummary): string {
  const parts: string[] = [];

  if (summary.ready > 0) {
    parts.push(`${summary.ready} ready`);
  }
  if (summary.indexing > 0) {
    parts.push(`${summary.indexing} indexing`);
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} failed`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'No repositories connected';
}

export function getRecentItems<T extends { updatedAt: string }>(items: T[], limit: number): T[] {
  return [...items]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

const RELATIVE_TIME_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  let duration = (new Date(isoDate).getTime() - now.getTime()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return relativeTimeFormatter.format(Math.round(duration), 'years');
}
