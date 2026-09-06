import type { AdminListedUser, AdminUsersPage, UpdateAdminUserPayload } from '@/entities';
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

export async function updateAdminUser(
  userId: string,
  payload: UpdateAdminUserPayload,
): Promise<AdminListedUser> {
  const { data } = await adminApiClient.patch<AdminListedUser>(`/admin/users/${userId}`, payload);
  return data;
}

export async function banAdminUser(userId: string): Promise<AdminListedUser> {
  const { data } = await adminApiClient.post<AdminListedUser>(`/admin/users/${userId}/ban`);
  return data;
}

export async function unbanAdminUser(userId: string): Promise<AdminListedUser> {
  const { data } = await adminApiClient.post<AdminListedUser>(`/admin/users/${userId}/unban`);
  return data;
}
