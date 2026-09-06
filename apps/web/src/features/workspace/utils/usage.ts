import type {
  IndexingResourceMetric,
  PlanSummary,
  UsageMetric,
  UsageMetricSnapshot,
  UsagePeriod,
  WorkspaceAiMode,
} from '@/entities';

export const USAGE_METRIC_LABELS: Record<UsageMetric, string> = {
  REPOSITORIES: 'Repository connections',
  INDEXING_RUNS: 'Indexing runs',
  GUIDE_GENERATIONS: 'Onboarding guides',
  AI_QUESTIONS: 'AI questions',
  MEMBERS: 'Workspace members',
};

export const INDEXING_RESOURCE_METRICS: IndexingResourceMetric[] = [
  'REPOSITORY_SIZE_BYTES',
  'INDEXABLE_FILES',
  'INDEXED_TOKENS',
  'EMBEDDING_CHUNKS',
  'FILE_SIZE_BYTES',
];

export const INDEXING_RESOURCE_METRIC_LABELS: Record<IndexingResourceMetric, string> = {
  REPOSITORY_SIZE_BYTES: 'Repository size',
  INDEXABLE_FILES: 'Indexable files',
  INDEXED_TOKENS: 'Indexed tokens',
  EMBEDDING_CHUNKS: 'Embedding chunks',
  FILE_SIZE_BYTES: 'Max file size',
};

/** LLM metrics billed to the workspace key; Hosted AI still uses plan caps. */
export const BYOK_UNLIMITED_METRICS: ReadonlySet<UsageMetric> = new Set([
  'AI_QUESTIONS',
  'GUIDE_GENERATIONS',
]);

export function formatPlan(plan: PlanSummary): string {
  return plan.name;
}

export function formatAiMode(aiMode: WorkspaceAiMode): string {
  return aiMode === 'BYOK' ? 'BYOK' : 'Hosted AI';
}

export function formatUsageLimit(metric: UsageMetricSnapshot): string {
  const limitLabel = metric.limit == null ? 'Unlimited' : String(metric.limit);
  const periodLabel = metric.period === 'MONTHLY' ? ' / month' : '';
  const remainingLabel = metric.remaining == null ? '' : ` · ${metric.remaining} remaining`;
  return `${metric.used} / ${limitLabel}${periodLabel}${remainingLabel}`;
}

export function formatUsageSummary(plan: PlanSummary, aiMode: WorkspaceAiMode): string {
  return `${formatPlan(plan)} plan · ${formatAiMode(aiMode)}`;
}

export function effectivePlanLimit(
  maxValue: number | null,
  metric: UsageMetric,
  isByok: boolean,
): number | null {
  if (isByok && BYOK_UNLIMITED_METRICS.has(metric)) {
    return null;
  }
  return maxValue;
}

export function formatLimitCap(maxValue: number | null, period: UsagePeriod): string {
  if (maxValue == null) {
    return 'Unlimited';
  }
  return period === 'MONTHLY' ? `${maxValue}/mo` : String(maxValue);
}

export function formatIndexingResourceCap(
  metric: IndexingResourceMetric,
  maxValue: number | null,
): string {
  if (maxValue == null) {
    return 'Unlimited';
  }
  if (metric === 'REPOSITORY_SIZE_BYTES' || metric === 'FILE_SIZE_BYTES') {
    return formatByteCap(maxValue);
  }
  return maxValue.toLocaleString();
}

function formatByteCap(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb && bytes % gb === 0) {
    return `${bytes / gb} GB`;
  }
  if (bytes >= mb && bytes % mb === 0) {
    return `${bytes / mb} MB`;
  }
  if (bytes >= mb) {
    return `${(bytes / mb).toFixed(1).replace(/\.0$/, '')} MB`;
  }
  return `${bytes.toLocaleString()} B`;
}
