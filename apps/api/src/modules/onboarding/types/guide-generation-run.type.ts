import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
  Prisma,
} from '@prisma/client';

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
  errors: Prisma.JsonValue | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface CreateOnboardingGuideGenerationRunInput {
  workspaceId: string;
  repositoryId: string;
  trigger: GuideGenerationTrigger;
  requestedTypes: GuideType[];
  totalGuideCount?: number;
  sourceIndexingRunId?: string | null;
  sourceCommitSha?: string | null;
}

export interface UpdateOnboardingGuideGenerationRunInput {
  status?: GuideGenerationStatus;
  totalGuideCount?: number;
  completedGuideCount?: number;
  error?: string | null;
  errors?: Prisma.InputJsonValue | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}
