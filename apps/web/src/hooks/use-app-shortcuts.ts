'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAppShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'd' && event.shiftKey) {
        router.push('/dashboard');
      }
      if (event.key === 'w' && event.shiftKey) {
        router.push('/workspace');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);
}
