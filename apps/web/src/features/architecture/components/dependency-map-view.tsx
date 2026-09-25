'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  Skeleton,
} from '@/shared/components';
import { useRepositoryQuery } from '@/features/repository';
import {
  useArchitectureModuleQuery,
  useDependencyMapQuery,
} from '../services/architecture.service';
import { describeBound, describeState, formatCount } from '../utils/dependency-map-presentation';
import { DependencyEvidenceDialog, type SelectedDependency } from './dependency-evidence-dialog';
import { LimitationsNote } from './limitations-note';
import { ModuleDetailPanel } from './module-detail-panel';
import { ModuleInventoryTable } from './module-inventory-table';
import { RevisionBanner } from './revision-banner';

interface DependencyMapViewProps {
  repositoryId: string;
}

export function DependencyMapView({ repositoryId }: DependencyMapViewProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';

  const repositoryQuery = useRepositoryQuery(workspaceId, repositoryId);
  const mapQuery = useDependencyMapQuery(workspaceId, repositoryId);

  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [inspectedDependency, setInspectedDependency] = useState<SelectedDependency | null>(null);

  const map = mapQuery.data;

  const visibleModules = useMemo(() => {
    const modules = map?.modules ?? [];
    const needle = moduleFilter.trim().toLowerCase();
    if (!needle) {
      return modules;
    }
    return modules.filter((module) => module.path.toLowerCase().includes(needle));
  }, [map?.modules, moduleFilter]);

  const activeModuleKey =
    selectedModuleKey && (map?.modules ?? []).some((module) => module.key === selectedModuleKey)
      ? selectedModuleKey
      : null;

  const moduleQuery = useArchitectureModuleQuery(workspaceId, repositoryId, activeModuleKey);

  if (!workspaceId) {
    return (
      <EmptyState
        title="No active workspace"
        description="Select a workspace to explore repository architecture."
      />
    );
  }

  if (mapQuery.isLoading || repositoryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (mapQuery.isError || !map) {
    return (
      <ErrorState
        title="Architecture view unavailable"
        description="The dependency view could not be loaded for this repository."
        action={
          <Button variant="outline" onClick={() => void mapQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const state = describeState(map);
  const moduleBoundNotice = describeBound(map.moduleBounds, 'modules');
  const repositoryName = repositoryQuery.data?.fullName ?? 'Repository';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dependency map"
        description={`Module dependencies in ${repositoryName}, derived from the indexed source.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/repositories/${repositoryId}`}>Back to repository</Link>
          </Button>
        }
      />

      <RevisionBanner map={map} />

      {state ? <EmptyState title={state.title} description={state.description} /> : null}

      {state && !state.showsModules ? (
        <LimitationsNote
          limitations={map.limitations}
          groupingRules={map.groupingRules}
          exclusions={map.exclusions}
          nonDependencyRelationCounts={map.nonDependencyRelationCounts}
        />
      ) : null}

      {!state || state.showsModules ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Modules" value={map.totals.moduleCount} />
            <SummaryTile label="Dependencies" value={map.totals.dependencyCount} />
            <SummaryTile label="Unresolved" value={map.totals.unresolvedRelationCount} />
            <SummaryTile label="External" value={map.totals.externalRelationCount} />
          </div>

          {map.focusedExplorationRequired ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              This repository has more modules than fit in a readable view, so focused exploration
              is in effect. Filter the list to reach a specific module.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Modules</CardTitle>
                <CardDescription>
                  {formatCount(map.modules.length, 'module')} shown, ordered by size and dependency
                  degree.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SearchInput
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  placeholder="Filter modules by path"
                />

                <div className="max-h-[28rem] overflow-y-auto">
                  {visibleModules.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No module matches this filter.
                    </p>
                  ) : (
                    <ModuleInventoryTable
                      modules={visibleModules}
                      selectedModuleKey={activeModuleKey}
                      onSelect={setSelectedModuleKey}
                    />
                  )}
                </div>

                {moduleBoundNotice ? (
                  <p className="text-xs text-muted-foreground">{moduleBoundNotice}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Module detail</CardTitle>
                <CardDescription>
                  Direct dependencies and dependents, with the evidence behind each one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModuleDetailPanel
                  repositoryId={repositoryId}
                  moduleKey={activeModuleKey}
                  detail={moduleQuery.data}
                  isLoading={moduleQuery.isLoading && Boolean(activeModuleKey)}
                  isError={moduleQuery.isError}
                  onInspectDependency={setInspectedDependency}
                />
              </CardContent>
            </Card>
          </div>

          <LimitationsNote
            limitations={map.limitations}
            groupingRules={map.groupingRules}
            exclusions={map.exclusions}
            nonDependencyRelationCounts={map.nonDependencyRelationCounts}
          />
        </>
      ) : null}

      <DependencyEvidenceDialog
        workspaceId={workspaceId}
        repositoryId={repositoryId}
        dependency={inspectedDependency}
        onOpenChange={(open) => {
          if (!open) {
            setInspectedDependency(null);
          }
        }}
      />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
