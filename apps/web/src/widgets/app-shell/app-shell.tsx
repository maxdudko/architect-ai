'use client';

import { useAppShortcuts } from '@/hooks';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  useAppShortcuts();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <main className="w-full flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
