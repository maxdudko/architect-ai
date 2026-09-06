'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CreditCard,
  Menu,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAuth } from '@/providers/admin-auth-provider';
import { BrandMark, Button, Dialog, DialogContent, DialogTrigger } from '@/shared/components';
import { cn } from '@/lib/utils';

const adminNavigation: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/usage', label: 'Usage', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {adminNavigation.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
              isActive && 'bg-accent text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function AdminMobileDrawer() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none border-r">
        <nav className="flex flex-col gap-1 pt-6">
          <AdminNavLinks />
        </nav>
      </DialogContent>
    </Dialog>
  );
}

function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
      <nav className="flex h-full flex-col gap-1 p-3">
        <AdminNavLinks />
      </nav>
    </aside>
  );
}

function AdminTopNav() {
  const { admin, logout } = useAdminAuth();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <AdminMobileDrawer />
        <Link href="/admin/users" className="text-sm">
          <BrandMark label="Architect AI Admin" />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {admin ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{admin.email}</span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminTopNav />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminSidebar />
        <main className="w-full flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
