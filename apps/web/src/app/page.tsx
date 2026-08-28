import { getServerAccessToken } from '@/lib/auth/cookies.server';
import { LandingPage } from '@/features/landing/components/landing-page';

function readHttpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export default async function Home() {
  const isAuthenticated = Boolean(await getServerAccessToken());
  return (
    <LandingPage
      isAuthenticated={isAuthenticated}
      creatorSiteUrl={readHttpUrl(process.env.CREATOR_SITE_URL)}
      creatorLinkedinUrl={readHttpUrl(process.env.CREATOR_LINKEDIN_URL)}
      githubRepoUrl={readHttpUrl(process.env.GITHUB_REPO_URL)}
    />
  );
}
