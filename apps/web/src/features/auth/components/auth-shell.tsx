import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components';
import { Network } from 'lucide-react';

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  footerHref?: string;
  footerAction?: string;
}

export function AuthShell({
  title,
  description,
  children,
  footerText,
  footerHref,
  footerAction,
}: AuthShellProps) {
  const showFooter = Boolean(footerText && footerHref && footerAction);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="border-b border-border/70 bg-background/90 backdrop-blur pb-2 mb-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight mb-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-[hsl(var(--landing-accent))] text-white">
              <Network className="size-4" aria-hidden="true" />
            </span>
            Architect AI
          </Link>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {showFooter ? (
          <p className="text-sm text-muted-foreground">
            {footerText}{' '}
            <Link
              href={footerHref!}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {footerAction}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
