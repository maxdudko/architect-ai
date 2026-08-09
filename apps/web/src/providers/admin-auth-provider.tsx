'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Admin } from '@/entities';
import {
  adminLogout as logoutRequest,
  adminSignIn as signInRequest,
  fetchAdminSession,
  refreshAdminTokens,
  registerAdminApiRefreshHandler,
} from '@/lib/api';
import {
  clearAdminAuthState,
  loadAdminAuthState,
  saveAdminAuthState,
  setAdminAccessTokenCookie,
} from '@/lib/auth/admin-storage';

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  admin: Admin | null;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [initialAuthState] = useState(() => loadAdminAuthState());
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => initialAuthState?.accessToken ?? null,
  );
  const [admin, setAdmin] = useState<Admin | null>(() => initialAuthState?.admin ?? null);

  const persistState = useCallback((params: { nextAccessToken: string; nextAdmin: Admin }) => {
    setAccessToken(params.nextAccessToken);
    setAdmin(params.nextAdmin);
    saveAdminAuthState({
      accessToken: params.nextAccessToken,
      admin: params.nextAdmin,
    });
  }, []);

  const resetState = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    clearAdminAuthState();
  }, []);

  const handleSessionExpired = useCallback(() => {
    resetState();
    const next =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/admin/users';
    router.replace(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  }, [resetState, router]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const data = await refreshAdminTokens();
      if (admin) {
        persistState({
          nextAccessToken: data.accessToken,
          nextAdmin: admin,
        });
      } else {
        setAccessToken(data.accessToken);
        setAdminAccessTokenCookie(data.accessToken);
      }
      return data.accessToken;
    } catch {
      handleSessionExpired();
      return null;
    }
  }, [admin, handleSessionExpired, persistState]);

  useEffect(() => {
    registerAdminApiRefreshHandler(refreshAccessToken);
    return () => registerAdminApiRefreshHandler(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!initialAuthState) {
        setIsReady(true);
        return;
      }

      setAdminAccessTokenCookie(initialAuthState.accessToken);

      try {
        const session = await fetchAdminSession();
        saveAdminAuthState({
          accessToken: initialAuthState.accessToken,
          admin: session.admin,
        });
        setAdmin(session.admin);
      } catch {
        handleSessionExpired();
      } finally {
        setIsReady(true);
      }
    };

    void bootstrapSession();
  }, [handleSessionExpired, initialAuthState]);

  const signIn = useCallback(
    async (payload: { email: string; password: string }) => {
      const response = await signInRequest(payload);
      persistState({
        nextAccessToken: response.accessToken,
        nextAdmin: response.admin,
      });
      router.push('/admin/users');
    },
    [persistState, router],
  );

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    resetState();
    router.push('/admin/sign-in');
  }, [resetState, router]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      isAuthenticated: Boolean(accessToken && admin),
      isReady,
      admin,
      signIn,
      logout,
    }),
    [accessToken, admin, isReady, logout, signIn],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const value = useContext(AdminAuthContext);
  if (!value) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return value;
}
