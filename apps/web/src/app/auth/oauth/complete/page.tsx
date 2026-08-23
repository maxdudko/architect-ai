'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { Loader } from '@/shared/components';

function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/dashboard';
  }
  return next;
}

function OauthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOAuthSession } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const next = sanitizeNextPath(searchParams.get('next'));

    void completeOAuthSession()
      .then(() => {
        router.replace(next);
      })
      .catch(() => {
        router.replace('/sign-in?oauth_error=session');
      });
  }, [completeOAuthSession, router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/20 p-4">
      <Loader className="h-5 w-5" />
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}

export default function OauthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
          <Loader className="h-5 w-5" />
        </div>
      }
    >
      <OauthCompleteContent />
    </Suspense>
  );
}
