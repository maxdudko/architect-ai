import { apiClient } from './axios';
import type { AuthResponse } from './types';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload extends SignInPayload {
  firstName: string;
  lastName: string;
}

export async function signIn(payload: SignInPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signin', payload);
  return data;
}

export async function signUp(payload: SignUpPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', payload);
  return data;
}

export async function fetchCurrentSession(
  accessToken?: string,
): Promise<Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>> {
  const { data } = await apiClient.get<
    Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>
  >('/auth/me', accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined);
  return data;
}

export async function logout(): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/logout', {});
  return data;
}

export async function refreshTokens(
  activeWorkspaceId?: string,
  legacyRefreshToken?: string,
): Promise<{
  accessToken: string;
}> {
  const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh', {
    ...(legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}),
    activeWorkspaceId,
  });
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(payload: {
  token: string;
  password: string;
}): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>('/auth/reset-password', payload);
  return data;
}

export async function updateProfile(payload: {
  firstName: string;
  lastName: string;
}): Promise<Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>> {
  const { data } = await apiClient.patch<
    Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>
  >('/auth/me', payload);
  return data;
}
