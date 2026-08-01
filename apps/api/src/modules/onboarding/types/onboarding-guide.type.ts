import { GuideType, Prisma } from '@prisma/client';

export interface OnboardingGuide {
  id: string;
  workspaceId: string;
  repositoryId: string;
  type: GuideType;
  slug: string;
  title: string;
  markdown: string;
  summary: string | null;
  metadata: Prisma.JsonValue;
  generationVersion: number;
  sourceIndexingRunId: string | null;
  sourceCommitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingGuideListFilters {
  types?: GuideType[];
  slugs?: string[];
  search?: string;
}

export interface OnboardingGuideDraft {
  type: GuideType;
  slug: string;
  title: string;
  markdown: string;
  summary?: string | null;
  metadata: Prisma.InputJsonValue;
}

export interface ReplaceOnboardingGuideSetInput {
  workspaceId: string;
  repositoryId: string;
  replacedTypes: GuideType[];
  guides: OnboardingGuideDraft[];
  sourceIndexingRunId?: string | null;
  sourceCommitSha?: string | null;
}
