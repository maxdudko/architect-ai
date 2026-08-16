import type { User, Workspace } from '@/entities';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { clientCookieAttributes } from './cookie-attributes';

const AUTH_STORAGE_KEY = 'architect.auth.session.v1';

export interface AuthStorageState {
  accessToken: string;
  user: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
}

interface LegacyAuthStorageState extends AuthStorageState {
  refreshToken?: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function setAccessTokenCookie(token: string): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${clientCookieAttributes()}`;
}

export function clearAccessTokenCookie(): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; ${clientCookieAttributes(0)}`;
}

export function saveAuthState(state: AuthStorageState): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  setAccessTokenCookie(state.accessToken);
}

export function loadAuthState():
  | (AuthStorageState & {
      legacyRefreshToken?: string;
    })
  | null {
  if (!isBrowser()) {
    return null;
  }
  const value = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as LegacyAuthStorageState;
    const { refreshToken, ...state } = parsed;
    if (!state.accessToken || !state.user || !state.activeWorkspace) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return {
      ...state,
      ...(refreshToken ? { legacyRefreshToken: refreshToken } : {}),
    };
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
