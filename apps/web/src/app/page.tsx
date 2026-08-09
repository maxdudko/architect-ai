import { getServerAccessToken } from '@/lib/auth/cookies.server';
import { LandingPage } from '@/features/landing/components/landing-page';

export default async function Home() {
  const isAuthenticated = Boolean(await getServerAccessToken());
  return <LandingPage isAuthenticated={isAuthenticated} />;
}
