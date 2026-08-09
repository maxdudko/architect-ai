'use client';

import Link from 'next/link';
import { useAdminAuth } from '@/providers/admin-auth-provider';
import { Button } from '@/shared/components';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin/users" className="text-sm font-semibold tracking-tight">
              Architect AI Admin
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/admin/analytics"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Analytics
              </Link>
              <Link
                href="/admin/users"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Users
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {admin ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{admin.email}</span>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
