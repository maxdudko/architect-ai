import { getServerAccessToken } from '@/lib/auth/cookies.server';
import { LandingPage } from '@/features/landing/components/landing-page';

function readHttpUrl(value: string | undefined): string | null {
  return readAbsoluteUrl(value, ['http:', 'https:']);
}

function readCreatorEmailUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  return readAbsoluteUrl(trimmed, ['mailto:', 'http:', 'https:']);
}

function readAbsoluteUrl(
  value: string | undefined,
  allowedProtocols: readonly string[],
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!allowedProtocols.includes(url.protocol)) {
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
      creatorEmailUrl={readCreatorEmailUrl(process.env.CREATOR_EMAIL_URL)}
      githubRepoUrl={readHttpUrl(process.env.GITHUB_REPO_URL)}
    />
  );
}
