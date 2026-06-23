import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components';

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText: string;
  footerHref: string;
  footerAction: string;
}

export function AuthShell({
  title,
  description,
  children,
  footerText,
  footerHref,
  footerAction,
}: AuthShellProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <p className="text-sm text-muted-foreground">
          {footerText}{' '}
          <Link
            href={footerHref}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {footerAction}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
