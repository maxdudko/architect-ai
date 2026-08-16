import { UsageDashboard } from '@/features/admin';
import { PageHeader } from '@/shared/components';

export default function AdminUsagePage() {
  return (
    <div>
      <PageHeader
        title="Usage"
        description="Configure Free plan limits and review usage across workspaces."
      />
      <UsageDashboard />
    </div>
  );
}
