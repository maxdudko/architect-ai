'use client';

import { InvitationForm } from '@/features/workspace';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';

export default function WorkspaceInvitationsPage() {
  const { activeWorkspace } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Invitations"
        description="Invite teammates and manage onboarding links."
      />
      {activeWorkspace ? (
        <InvitationForm workspaceId={activeWorkspace.id} />
      ) : (
        <EmptyState
          title="No active workspace"
          description="Choose a workspace to send invitations."
        />
      )}
    </div>
  );
}
