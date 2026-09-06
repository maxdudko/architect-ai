import Link from 'next/link';
import {
  BrandMark,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components';

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
          <Link href="/" className="mb-2">
            <BrandMark />
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
