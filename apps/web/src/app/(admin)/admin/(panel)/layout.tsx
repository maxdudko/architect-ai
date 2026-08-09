import { AdminShell } from '@/features/admin';
import { AdminAuthGuard } from '@/shared/components';

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard requireAuth>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGuard>
  );
}
