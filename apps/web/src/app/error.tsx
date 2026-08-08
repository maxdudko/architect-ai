'use client';

import { useEffect } from 'react';
import { loadAuthState } from '@/lib/auth/storage';
import { captureClientError } from '@/lib/monitoring/error-tracking';
import { Button, ErrorState } from '@/shared/components';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const authState = loadAuthState();
    void captureClientError(error, {
      userId: authState?.user.id ?? null,
      organizationId: authState?.activeWorkspace.id ?? null,
    });
  }, [error]);

  return (
    <main className="container py-8">
      <ErrorState
        title="Page failed to load"
        description="An unexpected error happened while rendering this route."
        action={
          <Button onClick={reset} variant="outline">
            Retry
          </Button>
        }
      />
    </main>
  );
}
