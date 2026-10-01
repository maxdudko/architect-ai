import { DependencyMapView } from '@/features/architecture';

interface RepositoryArchitecturePageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function RepositoryArchitecturePage({
  params,
}: RepositoryArchitecturePageProps) {
  const { repositoryId } = await params;
  return <DependencyMapView repositoryId={repositoryId} />;
}
