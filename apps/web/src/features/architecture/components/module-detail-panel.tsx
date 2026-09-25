'use client';

import Link from 'next/link';
import type { ArchitectureModuleDetail, ModuleDependency } from '@/entities';
import { ErrorState, Skeleton } from '@/shared/components';
import { describeBound, formatCount } from '../utils/dependency-map-presentation';
import { ConfidenceBadge } from './confidence-badge';
import type { SelectedDependency } from './dependency-evidence-dialog';

interface ModuleDetailPanelProps {
  repositoryId: string;
  moduleKey: string | null;
  detail: ArchitectureModuleDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onInspectDependency: (dependency: SelectedDependency) => void;
}

export function ModuleDetailPanel({
  repositoryId,
  moduleKey,
  detail,
  isLoading,
  isError,
  onInspectDependency,
}: ModuleDetailPanelProps) {
  if (!moduleKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a module to see what it depends on and what depends on it.
      </p>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !detail) {
    return (
      <ErrorState
        title="Module unavailable"
        description="This module could not be loaded for the current indexing revision."
      />
    );
  }

  const { module } = detail;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">{module.path}</h3>
        <p className="text-sm text-muted-foreground">
          {formatCount(module.fileCount, 'file')} · {formatCount(module.symbolCount, 'symbol')} ·{' '}
          {module.languages.join(', ') || 'no language recorded'}
        </p>
        {module.internalRelationCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {formatCount(module.internalRelationCount, 'import')} stay inside this module.
          </p>
        ) : null}
      </div>

      <DependencyList
        title="Depends on"
        emptyText="This module does not import any other module in this revision."
        dependencies={detail.dependencies}
        boundNotice={describeBound(detail.dependencyBounds, 'dependencies')}
        onInspect={onInspectDependency}
      />

      <DependencyList
        title="Depended on by"
        emptyText="No other module in this revision imports this module."
        dependencies={detail.dependents}
        boundNotice={describeBound(detail.dependentBounds, 'dependents')}
        onInspect={onInspectDependency}
      />

      {detail.unresolved.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Unresolved targets</h4>
          <p className="text-xs text-muted-foreground">
            Observed in source, but not attributable to a module here. No dependency is drawn for
            these.
          </p>
          <div className="space-y-1">
            {detail.unresolved.map((record) => (
              <div
                key={`${record.sourceFilePath}-${record.observedTarget ?? record.targetName}-${record.reason}`}
                className="rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-medium">
                    {record.observedTarget ?? record.targetName ?? 'unknown target'}
                  </span>
                  <ConfidenceBadge confidence={record.confidence} className="shrink-0" />
                </div>
                <p className="truncate text-xs text-muted-foreground">{record.sourceFilePath}</p>
                <p className="text-xs text-muted-foreground">{record.reasonDescription}</p>
                {record.occurrenceCount > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Seen {record.occurrenceCount} times.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {describeBound(detail.unresolvedBounds, 'unresolved targets') ? (
            <p className="text-xs text-muted-foreground">
              {describeBound(detail.unresolvedBounds, 'unresolved targets')}
            </p>
          ) : null}
        </section>
      ) : null}

      {detail.external.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">External targets</h4>
          <p className="text-xs text-muted-foreground">
            Identified as outside this repository. These never become modules in the graph.
          </p>
          <div className="flex flex-wrap gap-2">
            {detail.external.map((record) => (
              <span
                key={record.targetName}
                className="inline-flex items-center gap-2 rounded-md border border-border/70 px-2 py-1 text-xs"
              >
                <code>{record.targetName}</code>
                <span className="text-muted-foreground">×{record.occurrenceCount}</span>
                <ConfidenceBadge confidence={record.confidence} />
              </span>
            ))}
          </div>
          {describeBound(detail.externalBounds, 'external targets') ? (
            <p className="text-xs text-muted-foreground">
              {describeBound(detail.externalBounds, 'external targets')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Files</h4>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {detail.files.map((file) => (
            <p key={file.path} className="truncate text-xs text-muted-foreground">
              {file.path} · {file.language} · {file.lineCount} lines
            </p>
          ))}
        </div>
        {describeBound(detail.fileBounds, 'files') ? (
          <p className="text-xs text-muted-foreground">
            {describeBound(detail.fileBounds, 'files')}
          </p>
        ) : null}
        <Link
          href={`/repositories/${repositoryId}`}
          className="inline-block text-xs text-muted-foreground underline"
        >
          Browse these files and symbols
        </Link>
      </section>

      {detail.notableSymbols.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Notable symbols</h4>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {detail.notableSymbols.map((symbol) => (
              <p key={symbol.qualifiedName} className="truncate text-xs text-muted-foreground">
                <span className="text-foreground">{symbol.name}</span> · {symbol.type} ·{' '}
                {symbol.filePath}:{symbol.startLine}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

interface DependencyListProps {
  title: string;
  emptyText: string;
  dependencies: ModuleDependency[];
  boundNotice: string | null;
  onInspect: (dependency: SelectedDependency) => void;
}

function DependencyList({
  title,
  emptyText,
  dependencies,
  boundNotice,
  onInspect,
}: DependencyListProps) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>

      {dependencies.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : null}

      <div className="space-y-1">
        {dependencies.map((dependency) => (
          <button
            key={`${dependency.fromModuleKey}-${dependency.toModuleKey}`}
            type="button"
            onClick={() =>
              onInspect({
                from: dependency.fromModuleKey,
                to: dependency.toModuleKey,
              })
            }
            className="block w-full rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="truncate font-medium">{dependency.relatedModuleKey}</span>
              <ConfidenceBadge confidence={dependency.confidence} className="shrink-0" />
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatCount(dependency.supportingRelationCount, 'supporting import')} ·{' '}
              {dependency.relationTypes.join(', ')} · view evidence
            </span>
          </button>
        ))}
      </div>

      {boundNotice ? <p className="text-xs text-muted-foreground">{boundNotice}</p> : null}
    </section>
  );
}
