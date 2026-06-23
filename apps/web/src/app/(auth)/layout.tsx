import { AuthGuard } from '@/shared/components';

export default function UnauthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={false}>
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        {children}
      </div>
    </AuthGuard>
  );
}
