import type {
  GuideType,
  OnboardingGuide,
  OnboardingGuideGenerationRun,
  OnboardingGuideList,
} from '@/entities';
import { apiClient } from './axios';

export interface ListOnboardingGuidesParams {
  type?: GuideType;
  q?: string;
}

export interface GenerateOnboardingGuidesPayload {
  types?: GuideType[];
}

function guidesPath(workspaceId: string, repositoryId: string): string {
  return `/workspaces/${workspaceId}/repositories/${repositoryId}/guides`;
}

export async function listOnboardingGuides(
  workspaceId: string,
  repositoryId: string,
  params: ListOnboardingGuidesParams = {},
): Promise<OnboardingGuideList> {
  const { data } = await apiClient.get<OnboardingGuideList>(guidesPath(workspaceId, repositoryId), {
    params,
  });
  return data;
}

export async function getOnboardingGuide(
  workspaceId: string,
  repositoryId: string,
  guideId: string,
): Promise<OnboardingGuide> {
  const { data } = await apiClient.get<OnboardingGuide>(
    `${guidesPath(workspaceId, repositoryId)}/${guideId}`,
  );
  return data;
}

export async function generateOnboardingGuides(
  workspaceId: string,
  repositoryId: string,
  payload: GenerateOnboardingGuidesPayload = {},
): Promise<OnboardingGuideGenerationRun> {
  const { data } = await apiClient.post<OnboardingGuideGenerationRun>(
    `${guidesPath(workspaceId, repositoryId)}/generate`,
    payload,
  );
  return data;
}

export async function regenerateOnboardingGuides(
  workspaceId: string,
  repositoryId: string,
  payload: GenerateOnboardingGuidesPayload = {},
): Promise<OnboardingGuideGenerationRun> {
  const { data } = await apiClient.post<OnboardingGuideGenerationRun>(
    `${guidesPath(workspaceId, repositoryId)}/regenerate`,
    payload,
  );
  return data;
}

export async function getLatestOnboardingGuideRun(
  workspaceId: string,
  repositoryId: string,
): Promise<OnboardingGuideGenerationRun | null> {
  const { data } = await apiClient.get<OnboardingGuideGenerationRun | null>(
    `${guidesPath(workspaceId, repositoryId)}/generation-runs/latest`,
  );
  return data;
}
