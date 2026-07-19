import { RepositoryBrowse } from '@/features/repository';

interface RepositoryDetailPageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function RepositoryDetailPage({ params }: RepositoryDetailPageProps) {
  const { repositoryId } = await params;
  return <RepositoryBrowse repositoryId={repositoryId} />;
}
