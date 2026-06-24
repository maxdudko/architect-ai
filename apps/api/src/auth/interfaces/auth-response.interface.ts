import { WorkspaceRole } from '@prisma/client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    lastLoginAt: Date | null;
  };
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: WorkspaceRole;
  }>;
  activeWorkspace: {
    id: string;
    name: string;
    slug: string;
    role: WorkspaceRole;
  };
}
