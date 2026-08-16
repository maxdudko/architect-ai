'use client';

import { WorkspaceAiSettingsCard, WorkspaceSettingsForm, WorkspaceUsageCard, useWorkspaceUsageQuery } from '@/features/workspace';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';
import { canManageWorkspaceAi } from '@/features/workspace/utils/workspace-permissions';

function formatPlanLabel(plan: string | undefined): string {
  if (plan === 'PRO') return 'Pro';
  if (plan === 'ENTERPRISE') return 'Enterprise';
  return 'Free';
}

export default function WorkspaceSettingsPage() {
  const { activeWorkspace } = useAuth();
  const canManageAi = canManageWorkspaceAi(activeWorkspace?.role);
  const usageQuery = useWorkspaceUsageQuery(activeWorkspace?.id ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Manage workspace profile, usage, and AI provider."
      />
      {activeWorkspace ? (
        <>
          <WorkspaceSettingsForm
            workspaceId={activeWorkspace.id}
            initialName={activeWorkspace.name}
            planLabel={formatPlanLabel(usageQuery.data?.plan)}
          />
          <WorkspaceUsageCard workspaceId={activeWorkspace.id} />
          {canManageAi ? <WorkspaceAiSettingsCard workspaceId={activeWorkspace.id} /> : null}
        </>
      ) : (
        <EmptyState
          title="No active workspace"
          description="Choose a workspace from the switcher to edit settings."
        />
      )}
    </div>
  );
}
