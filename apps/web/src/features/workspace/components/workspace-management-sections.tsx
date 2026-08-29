'use client';

import { useAuth } from '@/providers/auth-provider';
import { EmptyState } from '@/shared/components';
import { WorkspacePeopleSection } from './workspace-people-section';
import { WorkspaceSettingsSection } from './workspace-settings-section';

export function WorkspaceManagementSections() {
  const { activeWorkspace } = useAuth();

  if (!activeWorkspace) {
    return (
      <EmptyState
        title="No active workspace"
        description="Choose a workspace to manage settings, members, and invitations."
      />
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePeopleSection />
      <WorkspaceSettingsSection />
    </div>
  );
}
