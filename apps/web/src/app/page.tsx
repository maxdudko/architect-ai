import { redirect } from 'next/navigation';
import { getServerAccessToken } from '@/lib/auth/cookies.server';

export default async function Home() {
  if (await getServerAccessToken()) {
    redirect('/dashboard');
  }
  redirect('/sign-in');
}
