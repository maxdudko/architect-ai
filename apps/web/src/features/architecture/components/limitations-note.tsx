import type { DependencyMap } from '@/entities';
import { formatCount } from '../utils/dependency-map-presentation';

interface LimitationsNoteProps {
  limitations: string[];
  groupingRules?: string[];
  exclusions?: DependencyMap['exclusions'];
  nonDependencyRelationCounts?: DependencyMap['nonDependencyRelationCounts'];
}

/**
 * The stated limitations of static analysis, the grouping rules that produced
 * the modules, and the relationship types that were counted but could not
 * produce a dependency.
 */
export function LimitationsNote({
  limitations,
  groupingRules,
  exclusions,
  nonDependencyRelationCounts,
}: LimitationsNoteProps) {
  return (
    <details className="rounded-lg border border-border/70 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">
        How this view was built, and what it cannot tell you
      </summary>

      <div className="mt-3 space-y-4 text-muted-foreground">
        {groupingRules && groupingRules.length > 0 ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">Grouping rules</p>
            <ul className="list-disc space-y-1 pl-5">
              {groupingRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {exclusions && exclusions.length > 0 ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">Excluded files</p>
            <ul className="list-disc space-y-1 pl-5">
              {exclusions.map((exclusion) => (
                <li key={exclusion.reason}>
                  {exclusion.reason} — {formatCount(exclusion.fileCount, 'file')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {nonDependencyRelationCounts && nonDependencyRelationCounts.length > 0 ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Relationship types that cannot produce a dependency
            </p>
            <p>
              These were extracted but carry no target path, so they are counted rather than drawn:{' '}
              {nonDependencyRelationCounts
                .map((entry) => `${entry.relationType} (${entry.count})`)
                .join(', ')}
              .
            </p>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="font-medium text-foreground">Limitations</p>
          <ul className="list-disc space-y-1 pl-5">
            {limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
