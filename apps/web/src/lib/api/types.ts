import type { User, Workspace } from '@/entities';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
}
