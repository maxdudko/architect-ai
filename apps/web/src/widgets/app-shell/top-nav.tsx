import Link from 'next/link';
import { WorkspaceSwitcher } from '@/features/workspace';
import { BrandMark } from '@/shared/components';
import { MobileDrawer } from './mobile-drawer';
import { Breadcrumbs } from './breadcrumbs';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <MobileDrawer />
        <Link href="/dashboard" className="text-sm">
          <BrandMark />
        </Link>
        <div className="max-w-xs flex-1">
          <WorkspaceSwitcher />
        </div>
        <div className="ml-3 flex-1">
          <Breadcrumbs />
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
