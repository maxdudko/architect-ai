'use client';

import { useAuth } from '@/providers/auth-provider';
import { useWorkspacesQuery } from '@/features/workspace';

export function useWorkspaceSwitcher() {
  const auth = useAuth();
  const workspaceQuery = useWorkspacesQuery();

  return {
    workspaces: workspaceQuery.data ?? auth.workspaces,
    activeWorkspace: auth.activeWorkspace,
    isLoading: workspaceQuery.isLoading,
    switchWorkspace: auth.switchWorkspace,
  };
}
