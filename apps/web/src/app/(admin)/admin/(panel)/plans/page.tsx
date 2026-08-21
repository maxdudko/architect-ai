import { PlansManager } from '@/features/admin';
import { PageHeader } from '@/shared/components';

export default function AdminPlansPage() {
  return (
    <div>
      <PageHeader
        title="Plans"
        description="Manage plans, standard/BYOK prices, and usage limits."
      />
      <PlansManager />
    </div>
  );
}
