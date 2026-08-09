import { useQuery } from '@tanstack/react-query';
import {
  getAdminAnalyticsOverview,
  listAdminActiveUsage,
  listAdminFeedback,
  listAdminQuestions,
  listAdminRepositoryEvents,
  listAdminSources,
  listAdminTokenUsage,
  type AdminActiveUsageParams,
  type AdminAnalyticsListParams,
} from '@/lib/api';

export function useAdminAnalyticsOverviewQuery() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => getAdminAnalyticsOverview(),
  });
}

export function useAdminRepositoryEventsQuery(params: AdminAnalyticsListParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'repository-events', params],
    queryFn: () => listAdminRepositoryEvents(params),
  });
}

export function useAdminQuestionsQuery(params: AdminAnalyticsListParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'questions', params],
    queryFn: () => listAdminQuestions(params),
  });
}

export function useAdminSourcesQuery(params: AdminAnalyticsListParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'sources', params],
    queryFn: () => listAdminSources(params),
  });
}

export function useAdminFeedbackQuery(params: AdminAnalyticsListParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'feedback', params],
    queryFn: () => listAdminFeedback(params),
  });
}

export function useAdminTokenUsageQuery(params: AdminAnalyticsListParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'token-usage', params],
    queryFn: () => listAdminTokenUsage(params),
  });
}

export function useAdminActiveUsageQuery(params: AdminActiveUsageParams) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'active-usage', params],
    queryFn: () => listAdminActiveUsage(params),
  });
}
