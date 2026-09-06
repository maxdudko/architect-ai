import { AuthShell, ResetPasswordForm } from '@/features/auth';

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a new password for your Architect AI account."
      footerText="Remember your password?"
      footerHref="/sign-in"
      footerAction="Sign in"
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
