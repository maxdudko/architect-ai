import Link from 'next/link';
import { ArrowRight, CircleDot, GitCommitHorizontal, Github } from 'lucide-react';
import type { ReactNode, SyntheticEvent } from 'react';

export type SectionLinkHandler = (event: SyntheticEvent, link: string) => void;

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--landing-accent))]">
      <CircleDot className="size-3" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SourceReference({ source }: { source: string }) {
  return (
    <div className="flex max-w-full items-center gap-2 truncate rounded-md border border-border/80 bg-background/75 px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">
      <GitCommitHorizontal
        className="size-3 shrink-0 text-[hsl(var(--landing-accent))]"
        aria-hidden="true"
      />
      <span className="truncate">{source}</span>
    </div>
  );
}

export function GitHubLink({
  className,
  iconClassName,
  href,
}: {
  className: string;
  iconClassName: string;
  href: string | null;
}) {
  const isDisabled = href == null;

  return (
    <a
      href={isDisabled ? undefined : href}
      target={isDisabled ? undefined : '_blank'}
      rel={isDisabled ? undefined : 'noreferrer'}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : undefined}
      title={isDisabled ? 'Repository is not public yet' : undefined}
      className={
        isDisabled
          ? `${className} cursor-not-allowed opacity-50 hover:text-muted-foreground`
          : className
      }
    >
      <Github className={iconClassName} aria-hidden="true" />
      GitHub
    </a>
  );
}

const primaryCtaClassName =
  'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#29903B] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function PrimaryCta({
  isAuthenticated,
  idleLabel,
  className,
}: {
  isAuthenticated: boolean;
  idleLabel: string;
  className?: string;
}) {
  return (
    <Link
      href={isAuthenticated ? '/dashboard' : '/sign-up'}
      className={className ?? primaryCtaClassName}
    >
      {isAuthenticated ? 'Open dashboard' : idleLabel}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
