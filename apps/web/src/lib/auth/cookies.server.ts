import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from './constants';

export async function getServerAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}
