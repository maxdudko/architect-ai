import { GuideGenerationTrigger, GuideType } from '@prisma/client';

export const ONBOARDING_GUIDE_QUEUE = 'onboarding-guide-generation';
export const ONBOARDING_GUIDE_JOB_NAME = 'generate-onboarding-guides';

export interface OnboardingGuideJobData {
  runId: string;
  workspaceId: string;
  repositoryId: string;
}

export interface ManualGuideGenerationRequest {
  workspaceId: string;
  repositoryId: string;
  requestedTypes?: GuideType[];
}

export interface PostIndexGuideGenerationRequest {
  workspaceId: string;
  repositoryId: string;
  trigger: Extract<GuideGenerationTrigger, 'INITIAL_INDEX' | 'REINDEX'>;
  sourceIndexingRunId: string;
  sourceCommitSha?: string | null;
  requestedTypes?: GuideType[];
}
