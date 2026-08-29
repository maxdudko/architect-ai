import type { PlanSummary } from './workspace';

export type UsageMetric =
  | 'REPOSITORIES'
  | 'INDEXING_RUNS'
  | 'GUIDE_GENERATIONS'
  | 'AI_QUESTIONS'
  | 'MEMBERS';

export type IndexingResourceMetric =
  | 'REPOSITORY_SIZE_BYTES'
  | 'INDEXABLE_FILES'
  | 'INDEXED_TOKENS'
  | 'EMBEDDING_CHUNKS'
  | 'FILE_SIZE_BYTES';

export type UsagePeriod = 'CURRENT' | 'MONTHLY';

export type WorkspaceAiMode = 'HOSTED' | 'BYOK';

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GROK' | 'GEMINI';

export interface UsageMetricSnapshot {
  metric: UsageMetric;
  period: UsagePeriod;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface IndexingResourceLimit {
  metric: IndexingResourceMetric;
  maxValue: number | null;
}

export interface WorkspaceUsage {
  workspaceId: string;
  plan: PlanSummary;
  aiMode: WorkspaceAiMode;
  metrics: UsageMetricSnapshot[];
  indexingLimits: IndexingResourceLimit[];
}

export interface WorkspaceAiCredentialSummary {
  provider: AiProvider;
  keyLast4: string;
  updatedAt: string;
}

export interface WorkspaceAiSettings {
  mode: WorkspaceAiMode;
  activeProvider: AiProvider | null;
  credentials: WorkspaceAiCredentialSummary[];
}

export interface WorkspaceAiKeyTestResult {
  ok: boolean;
  message: string;
}

export interface AdminWorkspaceUsageRow {
  workspaceId: string;
  name: string;
  slug: string;
  plan: PlanSummary;
  createdAt: string;
  aiMode: WorkspaceAiMode;
  metrics: UsageMetricSnapshot[];
  indexingLimits: IndexingResourceLimit[];
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AdminPlanLimit {
  metric: UsageMetric;
  period: UsagePeriod;
  maxValue: number | null;
}
