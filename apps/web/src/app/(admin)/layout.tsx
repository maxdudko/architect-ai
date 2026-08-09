import { AdminAuthProvider } from '@/providers/admin-auth-provider';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
