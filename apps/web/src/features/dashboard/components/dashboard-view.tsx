'use client';

import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';
import { ArchitectureWidget } from './architecture-widget';
import { ConversationsWidget } from './conversations-widget';
import { GuidesWidget } from './guides-widget';
import { PlaceholderWidget } from './placeholder-widget';
import { RepositoriesWidget } from './repositories-widget';
import { UsageWidget } from './usage-widget';
import { WorkspaceSetupWidget } from './workspace-setup-widget';

export function DashboardView() {
  const { activeWorkspace } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Usage, repositories, conversations, living guides, and workspace setup."
      />
      {!activeWorkspace ? (
        <EmptyState
          title="Select a workspace"
          description="Choose an active workspace to see repositories, conversations, and setup status."
        />
      ) : (
        <div className="space-x-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RepositoriesWidget workspaceId={activeWorkspace.id} />
            <GuidesWidget workspaceId={activeWorkspace.id} />
            <ConversationsWidget workspaceId={activeWorkspace.id} />
            <WorkspaceSetupWidget workspaceId={activeWorkspace.id} />
            <ArchitectureWidget workspaceId={activeWorkspace.id} />
            <PlaceholderWidget
              title="Decision Memory"
              description="Deep understanding of the project's evolution and the history of decisions made, enabling preserving architectural knowledge and making better technical decisions in the future."
            />
          </div>
          <div className="xl:w-2/3 2xl:w-1/3 mt-4 pr-3">
            <UsageWidget workspaceId={activeWorkspace.id} />
          </div>
        </div>
      )}
    </div>
  );
}
