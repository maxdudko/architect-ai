import Link from 'next/link';
import { AuthShell } from '@/features/auth';
import { Button } from '@/shared/components';

export default function ResetPasswordMissingPage() {
  return (
    <AuthShell
      title="Reset link missing"
      description="Request a new password reset email to continue."
      footerText="Remember your password?"
      footerHref="/sign-in"
      footerAction="Sign in"
    >
      <Button asChild className="w-full">
        <Link href="/forgot-password">Send a reset link</Link>
      </Button>
    </AuthShell>
  );
}
