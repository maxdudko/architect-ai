export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type WorkspacePlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface WorkspaceDetails {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
}
