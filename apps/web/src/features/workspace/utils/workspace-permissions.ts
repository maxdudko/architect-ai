import type { WorkspaceRole } from '@/entities';

export function canManageInvitations(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
