'use client';

import { WorkspaceSettingsForm } from '@/features/workspace';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';

export default function WorkspaceSettingsPage() {
  const { activeWorkspace } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Manage your current workspace profile and plan."
      />
      {activeWorkspace ? (
        <WorkspaceSettingsForm
          workspaceId={activeWorkspace.id}
          initialName={activeWorkspace.name}
          initialPlan="FREE"
        />
      ) : (
        <EmptyState
          title="No active workspace"
          description="Choose a workspace from the switcher to edit settings."
        />
      )}
    </div>
  );
}
