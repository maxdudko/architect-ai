import type { SystemOverview } from '@/entities';

export interface OverviewAvailability {
  title: string;
  description: string;
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'RUNNING']);

export function isOverviewRunActive(overview: SystemOverview): boolean {
  return overview.run != null && ACTIVE_STATUSES.has(overview.run.status);
}

export function describeOverviewAvailability(
  overview: SystemOverview,
): OverviewAvailability | null {
  if (overview.overview || isOverviewRunActive(overview)) {
    return null;
  }
  if (!overview.indexingAvailable || !overview.generationAllowed) {
    return {
      title: 'System overview is unavailable',
      description:
        'This repository has no successful indexing revision yet. Check its indexing state before generating an overview.',
    };
  }
  return {
    title: 'No system overview yet',
    description:
      'Generate an overview of the main modules, their dependencies, and what the index cannot establish.',
  };
}

export function describeOverviewProgress(overview: SystemOverview): string | null {
  if (!isOverviewRunActive(overview) || !overview.run) {
    return null;
  }
  const label = overview.run.status === 'QUEUED' ? 'Queued' : 'Writing';
  return `${label}. Step ${overview.run.completedStep} of ${overview.run.totalSteps}. The previous overview stays available until this one succeeds.`;
}

export function linkCitedPaths(markdown: string, repositoryId: string, paths: string[]): string {
  const ordered = [...paths].sort((left, right) => right.length - left.length);
  let linked = markdown;
  for (const path of ordered) {
    const href = `/repositories/${repositoryId}?${new URLSearchParams({
      file: path,
      returnTo: `/repositories/${repositoryId}/architecture/overview`,
    }).toString()}`;
    linked = linked.replaceAll(`\`${path}\``, `[${path}](${href})`);
  }
  return linked;
}
