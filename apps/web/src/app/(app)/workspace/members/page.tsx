'use client';

import { MembersList } from '@/features/workspace';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';

export default function WorkspaceMembersPage() {
  const { activeWorkspace } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader title="Workspace Members" description="View and manage team access." />
      {activeWorkspace ? (
        <MembersList workspaceId={activeWorkspace.id} />
      ) : (
        <EmptyState title="No active workspace" description="Choose a workspace to view members." />
      )}
    </div>
  );
}
