'use client';

import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';
import { ConversationsWidget } from './conversations-widget';
import { PlaceholderWidget } from './placeholder-widget';
import { RepositoriesWidget } from './repositories-widget';
import { WorkspaceSetupWidget } from './workspace-setup-widget';

export function DashboardView() {
  const { activeWorkspace } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Phase 1 control center: repositories, conversations, and workspace setup."
      />
      {!activeWorkspace ? (
        <EmptyState
          title="Select a workspace"
          description="Choose an active workspace to see repositories, conversations, and setup status."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <RepositoriesWidget workspaceId={activeWorkspace.id} />
          <ConversationsWidget workspaceId={activeWorkspace.id} />
          <WorkspaceSetupWidget workspaceId={activeWorkspace.id} />
          <PlaceholderWidget
            title="Knowledge Base"
            description="Generated architecture and code insights."
          />
          <PlaceholderWidget
            title="Upcoming AI Features"
            description="Planned capabilities for repository intelligence."
          />
        </div>
      )}
    </div>
  );
}
