import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/constants';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/repositories',
  '/chat',
  '/settings',
  '/workspace',
  '/workspaces',
];

const AUTH_PREFIXES = ['/sign-in', '/sign-up'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasToken) {
    const url = new URL('/unauthorized', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
