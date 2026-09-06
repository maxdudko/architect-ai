'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { EmptyState, Section } from '@/shared/components';
import { WorkspaceAiSettingsCard } from './workspace-ai-settings-card';
import { WorkspaceBillingCard } from './workspace-billing-card';
import { WorkspaceSettingsForm } from './workspace-settings-form';
import { WorkspaceUsageCard } from './workspace-usage-card';
import { useWorkspaceUsageQuery } from '../services/workspace.service';
import { canManageWorkspaceAi } from '../utils/workspace-permissions';

const WORKSPACES_PATH = '/workspaces';

function BillingCheckoutToast() {
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
    router.replace(WORKSPACES_PATH);
  }, [billingResult, router]);

  return null;
}

export function WorkspaceSettingsSection() {
  const { activeWorkspace } = useAuth();
  const canManageAi = canManageWorkspaceAi(activeWorkspace?.role);
  const usageQuery = useWorkspaceUsageQuery(activeWorkspace?.id ?? '');

  return (
    <Section
      title="Workspace Settings"
      description="Manage workspace profile, usage, and AI provider."
    >
      <Suspense fallback={null}>
        <BillingCheckoutToast />
      </Suspense>
      {activeWorkspace ? (
        <div className="space-y-6">
          <WorkspaceSettingsForm
            workspaceId={activeWorkspace.id}
            initialName={activeWorkspace.name}
            planLabel={usageQuery.data?.plan.name ?? 'Free'}
          />
          <div className="grid xl:grid-cols-2 gap-4">
            <WorkspaceUsageCard workspaceId={activeWorkspace.id} />
            {canManageAi ? <WorkspaceAiSettingsCard workspaceId={activeWorkspace.id} /> : null}
          </div>
          {canManageAi ? <WorkspaceBillingCard workspaceId={activeWorkspace.id} /> : null}
        </div>
      ) : (
        <EmptyState
          title="No active workspace"
          description="Choose a workspace from the switcher to edit settings."
        />
      )}
    </Section>
  );
}
