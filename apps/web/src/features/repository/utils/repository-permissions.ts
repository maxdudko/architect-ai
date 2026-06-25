import type { WorkspaceRole } from '@/entities';

export function canManageRepositories(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
}
