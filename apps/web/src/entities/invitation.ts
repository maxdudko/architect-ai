import type { WorkspaceRole } from './workspace';

export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
}
