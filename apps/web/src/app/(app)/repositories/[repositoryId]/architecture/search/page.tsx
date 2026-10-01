import { ArchitectureSearchView } from '@/features/architecture';

interface RepositoryArchitectureSearchPageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function RepositoryArchitectureSearchPage({
  params,
}: RepositoryArchitectureSearchPageProps) {
  const { repositoryId } = await params;
  return <ArchitectureSearchView repositoryId={repositoryId} />;
}
