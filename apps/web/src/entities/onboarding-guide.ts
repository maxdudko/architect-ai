export type GuideType =
  | 'EXECUTIVE_SUMMARY'
  | 'PROJECT_OVERVIEW'
  | 'FOLDER'
  | 'MODULE'
  | 'SERVICE'
  | 'TECHNOLOGY_STACK'
  | 'READING_ORDER'
  | 'GLOSSARY'
  | 'COMMON_PITFALLS';

export type GuideGenerationStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type GuideGenerationTrigger =
  | 'INITIAL_INDEX'
  | 'MANUAL_GENERATE'
  | 'MANUAL_REGENERATE'
  | 'REINDEX';

export interface OnboardingGuide {
  id: string;
  workspaceId: string;
  repositoryId: string;
  type: GuideType;
  slug: string;
  title: string;
  markdown: string;
  summary: string | null;
  metadata: unknown;
  generationVersion: number;
  sourceIndexingRunId: string | null;
  sourceCommitSha: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingGuideList {
  guides: OnboardingGuide[];
  total: number;
}

export interface OnboardingGuideGenerationRun {
  id: string;
  workspaceId: string;
  repositoryId: string;
  trigger: GuideGenerationTrigger;
  status: GuideGenerationStatus;
  requestedTypes: GuideType[];
  totalGuideCount: number;
  completedGuideCount: number;
  sourceIndexingRunId: string | null;
  sourceCommitSha: string | null;
  error: string | null;
  errors: unknown;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}
