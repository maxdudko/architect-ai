import { AuthShell } from '@/features/auth';
import { AdminSignInForm } from '@/features/admin';
import { AdminAuthGuard } from '@/shared/components';

export default function AdminSignInPage() {
  return (
    <AdminAuthGuard requireAuth={false}>
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <AuthShell title="Admin sign in" description="Access the Architect AI platform admin panel.">
          <AdminSignInForm />
        </AuthShell>
      </div>
    </AdminAuthGuard>
  );
}
