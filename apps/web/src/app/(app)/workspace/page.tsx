import { WorkspaceManagementSections } from '@/features/workspace';
import { PageHeader } from '@/shared/components';

export default function WorkspaceDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Workspace" description="Manage your active workspace operations." />
      <WorkspaceManagementSections />
    </div>
  );
}
