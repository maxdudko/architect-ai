'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumbs"
      className="hidden items-center text-sm text-muted-foreground md:flex"
    >
      <Link href="/dashboard" className="hover:text-foreground">
        Home
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        return (
          <span key={href} className="flex items-center">
            <ChevronRight className="mx-1 h-3 w-3" />
            <Link href={href} className="capitalize hover:text-foreground">
              {segment.replaceAll('-', ' ')}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
