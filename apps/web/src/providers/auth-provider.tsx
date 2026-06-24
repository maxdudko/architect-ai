'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Workspace } from '@/entities';
import {
  fetchCurrentSession,
  logout as logoutRequest,
  refreshTokens,
  signIn as signInRequest,
  signUp as signUpRequest,
  switchWorkspace as switchWorkspaceRequest,
  acceptInvitation as acceptInvitationRequest,
  registerApiRefreshHandler,
} from '@/lib/api';
import type { AcceptInvitationPayload } from '@/lib/api';
import {
  type AuthStorageState,
  clearAuthState,
  loadAuthState,
  saveAuthState,
  setAccessTokenCookie,
} from '@/lib/auth/storage';

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  user: User | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signUp: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  acceptInvitation: (token: string, payload?: AcceptInvitationPayload) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [initialAuthState] = useState<AuthStorageState | null>(() => loadAuthState());
  const [isReady, setIsReady] = useState<boolean>(() => initialAuthState === null);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => initialAuthState?.accessToken ?? null,
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    () => initialAuthState?.refreshToken ?? null,
  );
  const [user, setUser] = useState<User | null>(() => initialAuthState?.user ?? null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    () => initialAuthState?.workspaces ?? [],
  );
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    () => initialAuthState?.activeWorkspace ?? null,
  );

  const persistState = useCallback(
    (params: {
      nextAccessToken: string;
      nextRefreshToken: string;
      nextUser: User;
      nextWorkspaces: Workspace[];
      nextActiveWorkspace: Workspace;
    }) => {
      setAccessToken(params.nextAccessToken);
      setRefreshToken(params.nextRefreshToken);
      setUser(params.nextUser);
      setWorkspaces(params.nextWorkspaces);
      setActiveWorkspace(params.nextActiveWorkspace);
      saveAuthState({
        accessToken: params.nextAccessToken,
        refreshToken: params.nextRefreshToken,
        user: params.nextUser,
        workspaces: params.nextWorkspaces,
        activeWorkspace: params.nextActiveWorkspace,
      });
    },
    [],
  );

  const resetState = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    clearAuthState();
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken) {
      return null;
    }
    try {
      const data = await refreshTokens(refreshToken, activeWorkspace?.id);
      if (user && activeWorkspace) {
        persistState({
          nextAccessToken: data.accessToken,
          nextRefreshToken: data.refreshToken,
          nextUser: user,
          nextWorkspaces: workspaces,
          nextActiveWorkspace: activeWorkspace,
        });
      }
      return data.accessToken;
    } catch {
      resetState();
      return null;
    }
  }, [activeWorkspace, persistState, refreshToken, resetState, user, workspaces]);

  useEffect(() => {
    registerApiRefreshHandler(refreshAccessToken);
    return () => registerApiRefreshHandler(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!initialAuthState) {
      return;
    }
    setAccessTokenCookie(initialAuthState.accessToken);

    fetchCurrentSession()
      .then((session) => {
        saveAuthState({
          accessToken: initialAuthState.accessToken,
          refreshToken: initialAuthState.refreshToken,
          user: session.user,
          workspaces: session.workspaces,
          activeWorkspace: session.activeWorkspace,
        });
        setUser(session.user);
        setWorkspaces(session.workspaces);
        setActiveWorkspace(session.activeWorkspace);
      })
      .catch(() => {
        resetState();
      })
      .finally(() => {
        setIsReady(true);
      });
  }, [initialAuthState, resetState]);

  const signIn = useCallback(
    async (payload: { email: string; password: string }) => {
      const response = await signInRequest(payload);
      persistState({
        nextAccessToken: response.accessToken,
        nextRefreshToken: response.refreshToken,
        nextUser: response.user,
        nextWorkspaces: response.workspaces,
        nextActiveWorkspace: response.activeWorkspace,
      });
      router.push('/dashboard');
    },
    [persistState, router],
  );

  const signUp = useCallback(
    async (payload: { firstName: string; lastName: string; email: string; password: string }) => {
      const response = await signUpRequest(payload);
      persistState({
        nextAccessToken: response.accessToken,
        nextRefreshToken: response.refreshToken,
        nextUser: response.user,
        nextWorkspaces: response.workspaces,
        nextActiveWorkspace: response.activeWorkspace,
      });
      router.push('/dashboard');
    },
    [persistState, router],
  );

  const acceptInvitation = useCallback(
    async (token: string, payload?: AcceptInvitationPayload) => {
      const response = await acceptInvitationRequest(token, payload ?? {});
      persistState({
        nextAccessToken: response.accessToken,
        nextRefreshToken: response.refreshToken,
        nextUser: response.user,
        nextWorkspaces: response.workspaces,
        nextActiveWorkspace: response.activeWorkspace,
      });
      router.push('/dashboard');
    },
    [persistState, router],
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      await logoutRequest({ refreshToken }).catch(() => undefined);
    }
    resetState();
    router.push('/sign-in');
  }, [refreshToken, resetState, router]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!refreshToken || !user) {
        return;
      }
      const data = await switchWorkspaceRequest(workspaceId, refreshToken);
      const nextWorkspaces = workspaces.map((item) =>
        item.id === data.activeWorkspace.id ? data.activeWorkspace : item,
      );
      persistState({
        nextAccessToken: data.accessToken,
        nextRefreshToken: data.refreshToken,
        nextUser: user,
        nextWorkspaces,
        nextActiveWorkspace: data.activeWorkspace,
      });
    },
    [persistState, refreshToken, user, workspaces],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(accessToken && user),
      isReady,
      user,
      workspaces,
      activeWorkspace,
      signIn,
      signUp,
      acceptInvitation,
      logout,
      switchWorkspace,
    }),
    [
      accessToken,
      acceptInvitation,
      activeWorkspace,
      isReady,
      logout,
      signIn,
      signUp,
      user,
      workspaces,
      switchWorkspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
