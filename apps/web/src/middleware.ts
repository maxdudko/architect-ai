import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_ACCESS_TOKEN_COOKIE } from '@/lib/auth/admin-constants';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/constants';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/repositories',
  '/chat',
  '/settings',
  '/profile',
  '/workspace',
  '/workspaces',
];

const AUTH_PREFIXES = ['/sign-in', '/sign-up', '/forgot-password'];

const ADMIN_SIGN_IN_PATH = '/admin/sign-in';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasUserToken = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  const hasAdminToken = Boolean(request.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value);

  if (isAdminPath(pathname)) {
    const isAdminSignIn = pathname === ADMIN_SIGN_IN_PATH;

    if (!isAdminSignIn && !hasAdminToken) {
      const url = new URL(ADMIN_SIGN_IN_PATH, request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    if (isAdminSignIn && hasAdminToken) {
      return NextResponse.redirect(new URL('/admin/users', request.url));
    }

    return NextResponse.next();
  }

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasUserToken) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && hasUserToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
