import { WorkspaceRole } from '@prisma/client';

export interface RequestUser {
  sub: string;
  email: string;
  activeWorkspaceId: string;
  role?: WorkspaceRole;
}
