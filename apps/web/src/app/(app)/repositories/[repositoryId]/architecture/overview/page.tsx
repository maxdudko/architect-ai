import { SystemOverviewView } from '@/features/architecture';

interface ArchitectureOverviewPageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function ArchitectureOverviewPage({ params }: ArchitectureOverviewPageProps) {
  const { repositoryId } = await params;
  return <SystemOverviewView repositoryId={repositoryId} />;
}
