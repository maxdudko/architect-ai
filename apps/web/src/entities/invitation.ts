import type { WorkspaceRole } from './workspace';

export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
  emailSent?: boolean;
}

export interface InvitationPreview {
  email: string;
  role: WorkspaceRole;
  workspaceName: string;
  expiresAt: string;
  requiresSignUp: boolean;
}
