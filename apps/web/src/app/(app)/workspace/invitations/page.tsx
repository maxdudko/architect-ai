'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InvitationForm, InvitationsList } from '@/features/workspace';
import { canManageInvitations } from '@/features/workspace/utils/workspace-permissions';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, Loader, PageHeader } from '@/shared/components';

export default function WorkspaceInvitationsPage() {
  const router = useRouter();
  const { activeWorkspace, isReady } = useAuth();
  const canManage = canManageInvitations(activeWorkspace?.role);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (activeWorkspace && !canManage) {
      router.replace('/forbidden');
    }
  }, [activeWorkspace, canManage, isReady, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader className="h-5 w-5" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workspace Invitations"
          description="Invite teammates and manage onboarding links."
        />
        <EmptyState
          title="No active workspace"
          description="Choose a workspace to send invitations."
        />
      </div>
    );
  }

  if (!canManage) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Invitations"
        description="Invite teammates and manage onboarding links."
      />
      <div className="space-y-6">
        <InvitationForm workspaceId={activeWorkspace.id} />
        <InvitationsList workspaceId={activeWorkspace.id} />
      </div>
    </div>
  );
}
