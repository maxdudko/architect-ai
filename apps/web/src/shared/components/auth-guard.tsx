'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Loader } from './ui/loader';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth: boolean;
}

export function AuthGuard({ children, requireAuth }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (requireAuth && !isAuthenticated) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!requireAuth && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isReady, pathname, requireAuth, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-5 w-5" />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
