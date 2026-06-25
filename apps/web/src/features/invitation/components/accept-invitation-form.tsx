'use client';

import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Loader,
} from '@/shared/components';
import { useAcceptInvitation } from '../hooks/use-accept-invitation';

function formatRole(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const {
    previewState,
    form,
    onSubmit,
    handleAccept,
    errorMessage,
    isAccepting,
    emailMismatch,
    logout,
    isAuthenticated,
  } = useAcceptInvitation(token);

  const {
    register,
    formState: { errors },
  } = form;

  if (previewState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <Loader className="h-6 w-6" />
      </div>
    );
  }

  if (previewState.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
            <CardDescription>{previewState.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { preview } = previewState;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {preview.workspaceName}</CardTitle>
          <CardDescription>You have been invited as a {formatRole(preview.role)}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailMismatch ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">
                You are signed in with a different account. Sign out and open this link again using{' '}
                {preview.email}.
              </p>
              <Button type="button" variant="outline" onClick={() => void logout()}>
                Sign out
              </Button>
            </div>
          ) : preview.requiresSignUp ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  Email
                </label>
                <Input id="invite-email" type="email" value={preview.email} readOnly disabled />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    First name
                  </label>
                  <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
                  {errors.firstName ? (
                    <p className="text-xs text-destructive">{errors.firstName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    Last name
                  </label>
                  <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
                  {errors.lastName ? (
                    <p className="text-xs text-destructive">{errors.lastName.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                />
                {errors.password ? (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                ) : null}
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <Button type="submit" className="w-full" disabled={isAccepting}>
                {isAccepting ? <Loader className="mr-2 h-4 w-4" /> : null}
                Create account and join
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isAuthenticated
                  ? `Accept the invitation to join ${preview.workspaceName} with ${preview.email}.`
                  : `Sign in is not required. Join ${preview.workspaceName} with ${preview.email}.`}
              </p>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              <Button
                type="button"
                className="w-full"
                disabled={isAccepting}
                onClick={() => void handleAccept({})}
              >
                {isAccepting ? <Loader className="mr-2 h-4 w-4" /> : null}
                Join {preview.workspaceName}
              </Button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
