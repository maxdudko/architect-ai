import { AuthShell, OAuthButtons, SignInForm } from '@/features/auth';

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in to Architect AI"
      description="Continue to your workspace."
      footerText="Need an account?"
      footerHref="/sign-up"
      footerAction="Create one"
    >
      <SignInForm />
      <OAuthButtons />
    </AuthShell>
  );
}
