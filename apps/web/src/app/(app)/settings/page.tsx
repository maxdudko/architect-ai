import { SettingsPlaceholder } from '@/features/settings';
import { PageHeader } from '@/shared/components';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account-level settings and preferences." />
      <SettingsPlaceholder />
    </div>
  );
}
