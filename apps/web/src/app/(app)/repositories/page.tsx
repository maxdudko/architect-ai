import { RepositoryPlaceholder } from '@/features/repository';
import { PageHeader } from '@/shared/components';

export default function RepositoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Repository connectivity and indexing will ship in Phase 2."
      />
      <RepositoryPlaceholder />
    </div>
  );
}
