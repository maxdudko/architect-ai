import { Button } from '@/shared/components';
import type { DependencyMap } from '@/entities';
import { describeRevision } from '../utils/dependency-map-presentation';

interface RevisionBannerProps {
  map: DependencyMap;
  onLoadNewer?: () => void;
}

/**
 * States which indexing revision the view is derived from, and whether a
 * newer run is currently being produced.
 */
export function RevisionBanner({ map, onLoadNewer }: RevisionBannerProps) {
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
      {map.newerRevisionAvailable ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            A newer indexing revision is available. This view stays on the revision above until you
            load it.
          </p>
          {onLoadNewer ? (
            <Button type="button" size="sm" variant="outline" onClick={onLoadNewer}>
              Load newer revision
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
