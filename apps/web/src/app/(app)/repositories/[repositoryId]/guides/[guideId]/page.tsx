import { OnboardingGuidesView } from '@/features/onboarding';

interface RepositoryGuidePageProps {
  params: Promise<{ repositoryId: string; guideId: string }>;
}

export default async function RepositoryGuidePage({ params }: RepositoryGuidePageProps) {
  const { repositoryId, guideId } = await params;
  return <OnboardingGuidesView repositoryId={repositoryId} guideId={guideId} />;
}
