'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminAuth } from '@/providers/admin-auth-provider';
import { Loader } from './ui/loader';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requireAuth: boolean;
}

export function AdminAuthGuard({ children, requireAuth }: AdminAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isReady } = useAdminAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (requireAuth && !isAuthenticated) {
      router.replace(`/admin/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!requireAuth && isAuthenticated) {
      router.replace('/admin/users');
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
