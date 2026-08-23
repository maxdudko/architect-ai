'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/shared/components';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5000';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'false';
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED !== 'false';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. Please try again.',
  account_unavailable: 'This account is no longer available.',
  email_unavailable: 'Your provider account must have a verified email address.',
  invalid_state: 'Sign-in expired. Please try again.',
  not_configured: 'This sign-in method is not available.',
  provider_conflict: 'This provider is already linked to another login.',
  provider_error: 'Could not complete sign-in. Please try again.',
  session: 'Could not complete sign-in. Please try again.',
};

function oauthStartHref(provider: 'google' | 'github', next?: string | null): string {
  const url = new URL(`${API_BASE_URL}/auth/oauth/${provider}/start`);
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    url.searchParams.set('next', next);
  }
  return url.toString();
}

function OAuthButtonsContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const oauthError = searchParams.get('oauth_error');

  useEffect(() => {
    if (!oauthError) {
      return;
    }
    toast.error(OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.provider_error);
  }, [oauthError]);

  if (!GOOGLE_ENABLED && !GITHUB_ENABLED) {
    return null;
  }

  return (
    <div className="space-y-3 mt-4 mb-8">
      <div className="flex items-center gap-2">
        <div className="h-1 w-full border-b border-border/70 bg-background/90"></div>
        <div>or</div>
        <div className="h-1 w-full border-b border-border/70 bg-background/90"></div>
      </div>
      {GOOGLE_ENABLED ? (
        <Button asChild variant="outline" className="w-full">
          <a href={oauthStartHref('google', next)}>
            <GoogleIcon />
            Continue with Google
          </a>
        </Button>
      ) : null}
      {GITHUB_ENABLED ? (
        <Button asChild variant="outline" className="w-full">
          <a href={oauthStartHref('github', next)}>
            <GithubIcon />
            Continue with GitHub
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export function OAuthButtons() {
  return (
    <Suspense fallback={null}>
      <OAuthButtonsContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.64-.23-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.07 7.96-2.93l-3.88-3c-1.08.73-2.47 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.27V6.64H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.36l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.96 1.14 15.23 0 12 0 7.31 0 3.26 2.69 1.27 6.64l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.2a11.6 11.6 0 0 1 6.2 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 3 .1 3.3.8.9 1.2 2 1.2 3.3 0 4.7-2.8 5.7-5.5 6 .4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  );
}
