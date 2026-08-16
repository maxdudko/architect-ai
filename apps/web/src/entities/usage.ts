import type { WorkspacePlan } from './workspace';

export type UsageMetric =
  | 'REPOSITORIES'
  | 'INDEXING_RUNS'
  | 'GUIDE_GENERATIONS'
  | 'AI_QUESTIONS'
  | 'MEMBERS';

export type UsagePeriod = 'CURRENT' | 'MONTHLY';

export type WorkspaceAiMode = 'HOSTED' | 'BYOK';

export interface UsageMetricSnapshot {
  metric: UsageMetric;
  period: UsagePeriod;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface WorkspaceUsage {
  workspaceId: string;
  plan: WorkspacePlan;
  aiMode: WorkspaceAiMode;
  metrics: UsageMetricSnapshot[];
}

export interface WorkspaceAiSettings {
  mode: WorkspaceAiMode;
  openaiKeyLast4: string | null;
  updatedAt: string | null;
}

export interface WorkspaceAiKeyTestResult {
  ok: boolean;
  message: string;
}

export interface AdminWorkspaceUsageRow {
  workspaceId: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  createdAt: string;
  aiMode: WorkspaceAiMode;
  metrics: UsageMetricSnapshot[];
}

export interface AdminPlanLimit {
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}
