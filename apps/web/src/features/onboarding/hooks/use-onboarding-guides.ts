'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuideGenerationStatus, GuideType, OnboardingGuideGenerationRun } from '@/entities';
import {
  generateOnboardingGuides,
  getLatestOnboardingGuideRun,
  getOnboardingGuide,
  listOnboardingGuides,
  regenerateOnboardingGuides,
} from '@/lib/api';

const ACTIVE_STATUSES: GuideGenerationStatus[] = ['QUEUED', 'RUNNING'];
const MAX_POLL_AGE_MS = 15 * 60 * 1000;

export const ONBOARDING_GUIDE_QUERY_KEYS = {
  root: (workspaceId: string, repositoryId: string) =>
    ['workspaces', workspaceId, 'repositories', repositoryId, 'guides'] as const,
  list: (workspaceId: string, repositoryId: string, type?: GuideType, q?: string) =>
    [
      ...ONBOARDING_GUIDE_QUERY_KEYS.root(workspaceId, repositoryId),
      'list',
      type ?? null,
      q ?? null,
    ] as const,
  detail: (workspaceId: string, repositoryId: string, guideId: string) =>
    [...ONBOARDING_GUIDE_QUERY_KEYS.root(workspaceId, repositoryId), 'detail', guideId] as const,
  latestRun: (workspaceId: string, repositoryId: string) =>
    [
      ...ONBOARDING_GUIDE_QUERY_KEYS.root(workspaceId, repositoryId),
      'generation-runs',
      'latest',
    ] as const,
};

export function useOnboardingGuidesQuery(
  workspaceId: string,
  repositoryId: string,
  params: { type?: GuideType; q?: string } = {},
) {
  return useQuery({
    queryKey: ONBOARDING_GUIDE_QUERY_KEYS.list(workspaceId, repositoryId, params.type, params.q),
    queryFn: () => listOnboardingGuides(workspaceId, repositoryId, params),
    enabled: Boolean(workspaceId && repositoryId),
  });
}

export function useOnboardingGuideQuery(
  workspaceId: string,
  repositoryId: string,
  guideId: string,
) {
  return useQuery({
    queryKey: ONBOARDING_GUIDE_QUERY_KEYS.detail(workspaceId, repositoryId, guideId),
    queryFn: () => getOnboardingGuide(workspaceId, repositoryId, guideId),
    enabled: Boolean(workspaceId && repositoryId && guideId),
    retry: (failureCount, error: { response?: { status?: number } }) =>
      error.response?.status !== 404 && failureCount < 2,
  });
}

export function useLatestOnboardingGuideRunQuery(workspaceId: string, repositoryId: string) {
  const queryClient = useQueryClient();
  const previousStatus = useRef<GuideGenerationStatus | null>(null);
  const pollingStartedAt = useRef<number | null>(null);
  const query = useQuery({
    queryKey: ONBOARDING_GUIDE_QUERY_KEYS.latestRun(workspaceId, repositoryId),
    queryFn: () => getLatestOnboardingGuideRun(workspaceId, repositoryId),
    enabled: Boolean(workspaceId && repositoryId),
    refetchInterval: (currentQuery) => {
      const run = currentQuery.state.data as OnboardingGuideGenerationRun | null | undefined;
      if (!run || !ACTIVE_STATUSES.includes(run.status)) {
        pollingStartedAt.current = null;
        return false;
      }
      pollingStartedAt.current ??= Date.now();
      const createdAt = Date.parse(run.createdAt);
      const ageReference = Number.isFinite(createdAt) ? createdAt : pollingStartedAt.current;
      if (Date.now() - ageReference > MAX_POLL_AGE_MS) return false;
      return 2500;
    },
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const status = query.data?.status ?? null;
    const wasActive = previousStatus.current
      ? ACTIVE_STATUSES.includes(previousStatus.current)
      : false;
    if (wasActive && status === 'SUCCEEDED') {
      void queryClient.invalidateQueries({
        queryKey: ONBOARDING_GUIDE_QUERY_KEYS.root(workspaceId, repositoryId),
      });
    }
    previousStatus.current = status;
  }, [query.data?.status, queryClient, repositoryId, workspaceId]);

  return query;
}

function useGuideGenerationMutation(
  workspaceId: string,
  repositoryId: string,
  mode: 'generate' | 'regenerate',
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (types?: GuideType[]) =>
      mode === 'generate'
        ? generateOnboardingGuides(workspaceId, repositoryId, { types })
        : regenerateOnboardingGuides(workspaceId, repositoryId, { types }),
    onSuccess: (run) => {
      queryClient.setQueryData(
        ONBOARDING_GUIDE_QUERY_KEYS.latestRun(workspaceId, repositoryId),
        run,
      );
    },
  });
}

export function useGenerateOnboardingGuidesMutation(workspaceId: string, repositoryId: string) {
  return useGuideGenerationMutation(workspaceId, repositoryId, 'generate');
}

export function useRegenerateOnboardingGuidesMutation(workspaceId: string, repositoryId: string) {
  return useGuideGenerationMutation(workspaceId, repositoryId, 'regenerate');
}
