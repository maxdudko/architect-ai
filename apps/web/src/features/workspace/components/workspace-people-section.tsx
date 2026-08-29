'use client';

import { useAuth } from '@/providers/auth-provider';
import { EmptyState, Section } from '@/shared/components';
import { InvitationForm } from './invitation-form';
import { InvitationsList } from './invitations-list';
import { MembersList } from './members-list';
import { canManageInvitations } from '../utils/workspace-permissions';

export function WorkspacePeopleSection() {
  const { activeWorkspace } = useAuth();
  const canManage = canManageInvitations(activeWorkspace?.role);

  if (!activeWorkspace) {
    return (
      <EmptyState
        title="No active workspace"
        description="Choose a workspace to view members and invitations."
      />
    );
  }

  return (
    <div className={canManage ? 'grid gap-6 lg:grid-cols-2' : undefined}>
      <Section
        title="Workspace Members"
        description="View and manage team access."
        className="flex flex-col"
      >
        <MembersList workspaceId={activeWorkspace.id} className="flex-1" />
      </Section>
      {canManage ? (
        <Section
          title="Workspace Invitations"
          description="Invite teammates and manage onboarding links."
          className="flex flex-col"
        >
          <div className="flex flex-1 flex-col space-y-6">
            <InvitationForm workspaceId={activeWorkspace.id} />
            <InvitationsList workspaceId={activeWorkspace.id} className="flex-1" />
          </div>
        </Section>
      ) : null}
    </div>
  );
}
