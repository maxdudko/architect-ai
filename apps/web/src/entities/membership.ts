import type { User } from './user';
import type { WorkspaceRole } from './workspace';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REMOVED';

export interface Membership {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: string;
  lastSeenAt: string | null;
  user: User;
}
