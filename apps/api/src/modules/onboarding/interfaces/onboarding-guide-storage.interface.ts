import { GuideGenerationStatus, GuideType } from '@prisma/client';
import {
  CreateOnboardingGuideGenerationRunInput,
  OnboardingGuideGenerationRun,
  UpdateOnboardingGuideGenerationRunInput,
} from '../types/guide-generation-run.type';
import {
  OnboardingGuide,
  OnboardingGuideListFilters,
  ReplaceOnboardingGuideSetInput,
} from '../types/onboarding-guide.type';

export interface OnboardingGuideStorage {
  validateRepository(workspaceId: string, repositoryId: string): Promise<void>;

  validateRepositoryReady(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void>;

  listGuides(
    workspaceId: string,
    repositoryId: string,
    filters?: OnboardingGuideListFilters,
  ): Promise<OnboardingGuide[]>;

  getGuide(
    workspaceId: string,
    repositoryId: string,
    guideId: string,
  ): Promise<OnboardingGuide | null>;

  createGenerationRun(
    input: CreateOnboardingGuideGenerationRunInput,
  ): Promise<OnboardingGuideGenerationRun>;

  getGenerationRun(runId: string): Promise<OnboardingGuideGenerationRun | null>;

  updateGenerationRun(
    workspaceId: string,
    repositoryId: string,
    runId: string,
    input: UpdateOnboardingGuideGenerationRunInput,
  ): Promise<OnboardingGuideGenerationRun | null>;

  findActiveGenerationRun(
    workspaceId: string,
    repositoryId: string,
  ): Promise<OnboardingGuideGenerationRun | null>;

  findLatestGenerationRun(
    workspaceId: string,
    repositoryId: string,
    statuses?: GuideGenerationStatus[],
  ): Promise<OnboardingGuideGenerationRun | null>;

  replaceGuideSet(
    input: ReplaceOnboardingGuideSetInput,
  ): Promise<OnboardingGuide[]>;

  deleteGuide(
    workspaceId: string,
    repositoryId: string,
    guideId: string,
  ): Promise<boolean>;

  deleteGuides(
    workspaceId: string,
    repositoryId: string,
    types?: GuideType[],
  ): Promise<number>;
}
