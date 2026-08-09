import type { Admin } from '@/entities';
import { ADMIN_ACCESS_TOKEN_COOKIE } from './admin-constants';

const ADMIN_AUTH_STORAGE_KEY = 'architect.admin.auth.session.v1';

export interface AdminAuthStorageState {
  accessToken: string;
  admin: Admin;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function setAdminAccessTokenCookie(token: string): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ADMIN_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=86400; samesite=lax`;
}

export function clearAdminAccessTokenCookie(): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ADMIN_ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function saveAdminAuthState(state: AdminAuthStorageState): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(state));
  setAdminAccessTokenCookie(state.accessToken);
}

export function loadAdminAuthState(): AdminAuthStorageState | null {
  if (!isBrowser()) {
    return null;
  }
  const value = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as AdminAuthStorageState;
    if (!parsed.accessToken || !parsed.admin) {
      localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAdminAuthState(): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  clearAdminAccessTokenCookie();
}
