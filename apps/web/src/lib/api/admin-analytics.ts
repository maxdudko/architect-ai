import type {
  AdminActiveUsagePage,
  AdminAnalyticsOverview,
  AdminFeedbackRow,
  AdminPaginated,
  AdminQuestionRow,
  AdminRepositoryEvent,
  AdminSourceRow,
  AdminTokenUsageRow,
  AdminAnalyticsEventType,
} from '@/entities';
import { adminApiClient } from './admin-axios';

export interface AdminAnalyticsListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  workspaceId?: string;
  type?: AdminAnalyticsEventType;
}

export interface AdminActiveUsageParams {
  page?: number;
  pageSize?: number;
  days?: number;
}

export async function getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
  const { data } = await adminApiClient.get<AdminAnalyticsOverview>('/admin/analytics/overview');
  return data;
}

export async function listAdminRepositoryEvents(
  params: AdminAnalyticsListParams = {},
): Promise<AdminPaginated<AdminRepositoryEvent>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminRepositoryEvent>>(
    '/admin/analytics/repository-events',
    { params },
  );
  return data;
}

export async function listAdminQuestions(
  params: AdminAnalyticsListParams = {},
): Promise<AdminPaginated<AdminQuestionRow>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminQuestionRow>>(
    '/admin/analytics/questions',
    { params },
  );
  return data;
}

export async function listAdminSources(
  params: AdminAnalyticsListParams = {},
): Promise<AdminPaginated<AdminSourceRow>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminSourceRow>>(
    '/admin/analytics/sources',
    { params },
  );
  return data;
}

export async function listAdminFeedback(
  params: AdminAnalyticsListParams = {},
): Promise<AdminPaginated<AdminFeedbackRow>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminFeedbackRow>>(
    '/admin/analytics/feedback',
    { params },
  );
  return data;
}

export async function listAdminTokenUsage(
  params: AdminAnalyticsListParams = {},
): Promise<AdminPaginated<AdminTokenUsageRow>> {
  const { data } = await adminApiClient.get<AdminPaginated<AdminTokenUsageRow>>(
    '/admin/analytics/token-usage',
    { params },
  );
  return data;
}

export async function listAdminActiveUsage(
  params: AdminActiveUsageParams = {},
): Promise<AdminActiveUsagePage> {
  const { data } = await adminApiClient.get<AdminActiveUsagePage>('/admin/analytics/active-usage', {
    params,
  });
  return data;
}
