import {
  CreateWorkspaceForm,
  WorkspaceList,
  WorkspaceManagementSections,
} from '@/features/workspace';
import { PageHeader } from '@/shared/components';

export default function WorkspacesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Workspaces" description="Create and manage team workspaces." />
      <div className="grid gap-6 lg:grid-cols-2">
        <CreateWorkspaceForm />
        <WorkspaceList />
      </div>
      <PageHeader title="Workspace" description="Manage your active workspace operations." />
      <WorkspaceManagementSections buttonSize="lg" />
    </div>
  );
}
