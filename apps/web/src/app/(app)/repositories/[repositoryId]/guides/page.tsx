import { OnboardingGuidesView } from '@/features/onboarding';

interface RepositoryGuidesPageProps {
  params: Promise<{ repositoryId: string }>;
}

export default async function RepositoryGuidesPage({ params }: RepositoryGuidesPageProps) {
  const { repositoryId } = await params;
  return <OnboardingGuidesView repositoryId={repositoryId} />;
}
