import { AuthShell, ForgotPasswordForm } from '@/features/auth';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we will send a reset link if an account exists."
      footerText="Remember your password?"
      footerHref="/sign-in"
      footerAction="Sign in"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
