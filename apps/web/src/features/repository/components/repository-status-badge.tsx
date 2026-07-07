'use client';

import { LoaderCircle } from 'lucide-react';
import type { RepositoryStatus } from '@/entities';
import { Badge } from '@/shared/components';
import { getRepositoryStatusLabel, isRepositoryIndexingActive } from '../utils/repository-status';

interface RepositoryStatusBadgeProps {
  status: RepositoryStatus;
}

export function RepositoryStatusBadge({ status }: RepositoryStatusBadgeProps) {
  const isActive = isRepositoryIndexingActive(status);

  return (
    <Badge variant="outline" className="inline-flex items-center gap-1.5">
      {isActive ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {getRepositoryStatusLabel(status)}
    </Badge>
  );
}
