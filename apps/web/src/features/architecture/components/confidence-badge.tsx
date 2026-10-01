import type { DependencyConfidence } from '@/entities';
import { Badge } from '@/shared/components';
import { cn } from '@/lib/utils';
import { describeConfidence } from '../utils/dependency-map-presentation';

interface ConfidenceBadgeProps {
  confidence: DependencyConfidence;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const presentation = describeConfidence(confidence);

  return (
    <Badge
      variant="outline"
      title={presentation.description}
      className={cn(presentation.className, className)}
    >
      {presentation.label}
    </Badge>
  );
}
