import type { User, Workspace } from '@/entities';
import { ACCESS_TOKEN_COOKIE } from './constants';

const AUTH_STORAGE_KEY = 'architect.auth.session.v1';

export interface AuthStorageState {
  accessToken: string;
  refreshToken: string;
  user: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function setAccessTokenCookie(token: string): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=86400; samesite=lax`;
}

export function clearAccessTokenCookie(): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function saveAuthState(state: AuthStorageState): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  setAccessTokenCookie(state.accessToken);
}

export function loadAuthState(): AuthStorageState | null {
  if (!isBrowser()) {
    return null;
  }
  const value = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as AuthStorageState;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAuthState(): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  clearAccessTokenCookie();
}
