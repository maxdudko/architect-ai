import type { WorkspaceRole } from '@/entities';

export function canManageInvitations(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canManageWorkspaceAi(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
