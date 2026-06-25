'use client';

import { useEffect } from 'react';
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
