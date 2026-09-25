'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Skeleton,
} from '@/shared/components';
import { useDependencyEvidenceQuery } from '../services/architecture.service';
import { describeBound } from '../utils/dependency-map-presentation';
import { ConfidenceBadge } from './confidence-badge';

export interface SelectedDependency {
  from: string;
  to: string;
}

interface DependencyEvidenceDialogProps {
  workspaceId: string;
  repositoryId: string;
  dependency: SelectedDependency | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The source locations behind one module dependency. Evidence is read from the
 * indexing result, never generated, and is bounded per dependency.
 */
export function DependencyEvidenceDialog({
  workspaceId,
  repositoryId,
  dependency,
  onOpenChange,
}: DependencyEvidenceDialogProps) {
  const evidenceQuery = useDependencyEvidenceQuery(workspaceId, repositoryId, dependency);
  const evidence = evidenceQuery.data;
  const boundNotice = evidence ? describeBound(evidence.bounds, 'supporting imports') : null;

  return (
    <Dialog open={Boolean(dependency)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">
              {dependency?.from} → {dependency?.to}
            </span>
            {evidence ? <ConfidenceBadge confidence={evidence.confidence} /> : null}
          </DialogTitle>
          <DialogDescription>
            {evidence
              ? `${evidence.supportingRelationCount} supporting ${evidence.supportingRelationCount === 1 ? 'import' : 'imports'} · ${evidence.relationTypes.join(', ')}`
              : 'Loading the source locations behind this dependency…'}
          </DialogDescription>
        </DialogHeader>

        {evidenceQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}

        {evidenceQuery.isError ? (
          <ErrorState
            title="Evidence unavailable"
            description="The source evidence for this dependency could not be loaded."
          />
        ) : null}

        {evidence ? (
          <div className="max-h-[24rem] space-y-2 overflow-y-auto">
            {evidence.items.map((item) => (
              <div
                key={`${item.source.filePath}-${item.target.filePath}-${item.observedTarget ?? ''}`}
                className="rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <p className="truncate font-medium">{item.source.filePath}</p>
                <p className="truncate text-xs text-muted-foreground">
                  imports{' '}
                  <code className="rounded bg-muted px-1">
                    {item.observedTarget ?? item.targetName ?? 'unknown'}
                  </code>
                </p>
                <p className="truncate text-xs text-muted-foreground">→ {item.target.filePath}</p>
                <p className="text-xs text-muted-foreground">
                  {item.source.relationType} · matched by {formatStrategy(item.resolutionStrategy)}
                </p>
              </div>
            ))}

            {boundNotice ? (
              <p className="pt-1 text-xs text-muted-foreground">{boundNotice}</p>
            ) : null}

            <p className="pt-1 text-xs text-muted-foreground">
              Import relationships are recorded against the file, so evidence identifies the source
              and target files rather than the individual import line.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function formatStrategy(strategy: string): string {
  if (strategy === 'RELATIVE_PATH') return 'relative path';
  if (strategy === 'PATH_SUFFIX') return 'unique path suffix';
  if (strategy === 'PYTHON_MODULE_PATH') return 'Python module path';
  return strategy;
}
