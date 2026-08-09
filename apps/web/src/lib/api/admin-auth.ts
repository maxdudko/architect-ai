import type { Admin } from '@/entities';
import { adminApiClient } from './admin-axios';

export interface AdminSignInPayload {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  accessToken: string;
  admin: Admin;
}

export async function adminSignIn(payload: AdminSignInPayload): Promise<AdminAuthResponse> {
  const { data } = await adminApiClient.post<AdminAuthResponse>('/admin/auth/signin', payload);
  return data;
}

export async function fetchAdminSession(): Promise<{ admin: Admin }> {
  const { data } = await adminApiClient.get<{ admin: Admin }>('/admin/auth/me');
  return data;
}

export async function adminLogout(): Promise<{ success: boolean }> {
  const { data } = await adminApiClient.post<{ success: boolean }>('/admin/auth/logout', {});
  return data;
}

export async function refreshAdminTokens(): Promise<{ accessToken: string }> {
  const { data } = await adminApiClient.post<{ accessToken: string }>('/admin/auth/refresh', {});
  return data;
}
