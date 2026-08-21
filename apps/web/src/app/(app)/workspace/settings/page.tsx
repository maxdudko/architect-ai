'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import {
  WorkspaceAiSettingsCard,
  WorkspaceBillingCard,
  WorkspaceSettingsForm,
  WorkspaceUsageCard,
  useWorkspaceUsageQuery,
} from '@/features/workspace';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, PageHeader } from '@/shared/components';
import { canManageWorkspaceAi } from '@/features/workspace/utils/workspace-permissions';

export default function WorkspaceSettingsPage() {
  const { activeWorkspace } = useAuth();
  const canManageAi = canManageWorkspaceAi(activeWorkspace?.role);
  const usageQuery = useWorkspaceUsageQuery(activeWorkspace?.id ?? '');
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingResult = searchParams.get('billing');

  useEffect(() => {
    if (!billingResult) {
      return;
    }
    if (billingResult === 'success') {
      toast.success('Subscription updated. It may take a moment to reflect below.');
    } else if (billingResult === 'cancel') {
      toast.info('Checkout canceled.');
    }
    router.replace('/workspace/settings');
  }, [billingResult, router]);

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
            planLabel={usageQuery.data?.plan.name ?? 'Free'}
          />
          <WorkspaceUsageCard workspaceId={activeWorkspace.id} />
          {canManageAi ? <WorkspaceBillingCard workspaceId={activeWorkspace.id} /> : null}
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
