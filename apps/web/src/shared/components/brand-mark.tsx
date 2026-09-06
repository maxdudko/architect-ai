import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  label?: string;
}

export function BrandMark({ className, label = 'Architect AI' }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-[hsl(var(--landing-accent))] text-white">
        <Network className="size-4" aria-hidden="true" />
      </span>
      {label}
    </span>
  );
}
