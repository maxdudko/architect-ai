import type { User, Workspace } from '@/entities';

export interface AuthResponse {
  accessToken: string;
  user: User;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
}
