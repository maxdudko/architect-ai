import { RepositoriesList } from '@/features/repository';
import { PageHeader } from '@/shared/components';

export default function RepositoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Connect and manage repositories for your active workspace."
      />
      <RepositoriesList />
    </div>
  );
}
