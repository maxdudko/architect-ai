import type { UsageMetric, UsageMetricSnapshot, WorkspaceAiMode, WorkspacePlan } from '@/entities';

export const USAGE_METRIC_LABELS: Record<UsageMetric, string> = {
  REPOSITORIES: 'Repository connections',
  INDEXING_RUNS: 'Indexing runs',
  GUIDE_GENERATIONS: 'Onboarding guides',
  AI_QUESTIONS: 'AI questions',
  MEMBERS: 'Workspace members',
};

export function formatPlan(plan: WorkspacePlan): string {
  if (plan === 'FREE') return 'Free';
  if (plan === 'PRO') return 'Pro';
  return 'Enterprise';
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

export function formatUsageSummary(plan: WorkspacePlan, aiMode: WorkspaceAiMode): string {
  return `${formatPlan(plan)} plan · ${formatAiMode(aiMode)}`;
}
