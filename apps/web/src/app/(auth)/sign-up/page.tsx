import { AuthShell, SignUpForm } from '@/features/auth';

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your Architect AI account"
      description="Start onboarding your engineering workspace."
      footerText="Already have an account?"
      footerHref="/sign-in"
      footerAction="Sign in"
    >
      <SignUpForm />
    </AuthShell>
  );
}
