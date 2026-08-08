'use client';

import { useEffect } from 'react';
import { loadAuthState } from '@/lib/auth/storage';
import { captureClientError } from '@/lib/monitoring/error-tracking';
import { Button } from '@/shared/components';

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-6">
          <h1 className="text-xl font-semibold">Application error</h1>
          <p className="text-sm text-muted-foreground">
            The application encountered an unrecoverable error.
          </p>
          <Button onClick={reset}>Retry</Button>
        </div>
      </body>
    </html>
  );
}
