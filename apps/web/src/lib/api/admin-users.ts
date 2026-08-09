import type { AdminUsersPage } from '@/entities';
import { adminApiClient } from './admin-axios';

export interface ListAdminUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  includeDeleted?: boolean;
}

export async function listAdminUsers(params: ListAdminUsersParams = {}): Promise<AdminUsersPage> {
  const { data } = await adminApiClient.get<AdminUsersPage>('/admin/users', {
    params,
  });
  return data;
}
