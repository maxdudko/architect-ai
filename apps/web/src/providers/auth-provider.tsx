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
  const [initialAuthState] = useState(() => loadAuthState());
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => initialAuthState?.accessToken ?? null,
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
      nextUser: User;
      nextWorkspaces: Workspace[];
      nextActiveWorkspace: Workspace;
    }) => {
      setAccessToken(params.nextAccessToken);
      setUser(params.nextUser);
      setWorkspaces(params.nextWorkspaces);
      setActiveWorkspace(params.nextActiveWorkspace);
      saveAuthState({
        accessToken: params.nextAccessToken,
        user: params.nextUser,
        workspaces: params.nextWorkspaces,
        activeWorkspace: params.nextActiveWorkspace,
      });
    },
    [],
  );

  const resetState = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    clearAuthState();
  }, []);

  const handleSessionExpired = useCallback(() => {
    resetState();
    const next =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/dashboard';
    router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
  }, [resetState, router]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const data = await refreshTokens(activeWorkspace?.id);
      if (user && activeWorkspace) {
        persistState({
          nextAccessToken: data.accessToken,
          nextUser: user,
          nextWorkspaces: workspaces,
          nextActiveWorkspace: activeWorkspace,
        });
      } else {
        setAccessToken(data.accessToken);
        setAccessTokenCookie(data.accessToken);
      }
      return data.accessToken;
    } catch {
      handleSessionExpired();
      return null;
    }
  }, [activeWorkspace, handleSessionExpired, persistState, user, workspaces]);

  useEffect(() => {
    registerApiRefreshHandler(refreshAccessToken);
    return () => registerApiRefreshHandler(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!initialAuthState) {
        setIsReady(true);
        return;
      }

      setAccessTokenCookie(initialAuthState.accessToken);
      let accessToken = initialAuthState.accessToken;

      if (initialAuthState.legacyRefreshToken) {
        try {
          const refreshed = await refreshTokens(
            initialAuthState.activeWorkspace.id,
            initialAuthState.legacyRefreshToken,
          );
          accessToken = refreshed.accessToken;
          setAccessToken(accessToken);
          setAccessTokenCookie(accessToken);
        } catch {
          handleSessionExpired();
          setIsReady(true);
          return;
        }
      }

      try {
        const session = await fetchCurrentSession();
        saveAuthState({
          accessToken,
          user: session.user,
          workspaces: session.workspaces,
          activeWorkspace: session.activeWorkspace,
        });
        setUser(session.user);
        setWorkspaces(session.workspaces);
        setActiveWorkspace(session.activeWorkspace);
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
        nextUser: response.user,
        nextWorkspaces: response.workspaces,
        nextActiveWorkspace: response.activeWorkspace,
      });
      router.push('/dashboard');
    },
    [persistState, router],
  );

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    resetState();
    router.push('/sign-in');
  }, [resetState, router]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!user) {
        return;
      }
      const data = await switchWorkspaceRequest(workspaceId);
      const nextWorkspaces = workspaces.map((item) =>
        item.id === data.activeWorkspace.id ? data.activeWorkspace : item,
      );
      persistState({
        nextAccessToken: data.accessToken,
        nextUser: user,
        nextWorkspaces,
        nextActiveWorkspace: data.activeWorkspace,
      });
    },
    [persistState, user, workspaces],
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
