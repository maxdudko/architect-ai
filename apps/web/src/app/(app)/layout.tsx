import { AuthGuard } from '@/shared/components';
import { AppShell } from '@/widgets';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
