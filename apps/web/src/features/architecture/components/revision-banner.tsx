import type { DependencyMap } from '@/entities';
import { describeRevision } from '../utils/dependency-map-presentation';

interface RevisionBannerProps {
  map: DependencyMap;
}

/**
 * States which indexing revision the view is derived from, and whether a
 * newer run is currently being produced.
 */
export function RevisionBanner({ map }: RevisionBannerProps) {
  if (!map.revision) {
    return null;
  }

  const completedAt = map.revision.completedAt
    ? new Date(map.revision.completedAt).toLocaleString()
    : null;

  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium">Derived from indexing revision {describeRevision(map)}</p>
      <p className="text-xs text-muted-foreground">
        {completedAt ? `Indexed ${completedAt}. ` : null}
        Every module, dependency and piece of evidence on this page comes from this one revision.
      </p>
      {map.rebuildInProgress ? (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          A newer indexing run is in progress. This view stays on the revision above until that run
          succeeds.
        </p>
      ) : null}
    </div>
  );
}
