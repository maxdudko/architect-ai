import type { AdminLogsPage, AdminSystemLogCategory, AdminSystemLogLevel } from '@/entities';
import { adminApiClient } from './admin-axios';

export interface ListAdminLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: AdminSystemLogCategory;
  level?: AdminSystemLogLevel;
  from?: string;
  to?: string;
}

export async function listAdminLogs(params: ListAdminLogsParams = {}): Promise<AdminLogsPage> {
  const { data } = await adminApiClient.get<AdminLogsPage>('/admin/logs', {
    params,
  });
  return data;
}
