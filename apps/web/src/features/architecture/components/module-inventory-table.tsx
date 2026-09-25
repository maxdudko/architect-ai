'use client';

import type { ArchitectureModuleSummary } from '@/entities';

interface ModuleInventoryTableProps {
  modules: ArchitectureModuleSummary[];
  selectedModuleKey: string | null;
  onSelect: (moduleKey: string) => void;
}

export function ModuleInventoryTable({
  modules,
  selectedModuleKey,
  onSelect,
}: ModuleInventoryTableProps) {
  return (
    <div className="space-y-1">
      {modules.map((module) => {
        const isSelected = module.key === selectedModuleKey;
        return (
          <button
            key={module.key}
            type="button"
            onClick={() => onSelect(module.key)}
            aria-current={isSelected}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              isSelected
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{module.path}</span>
              <span className="shrink-0 text-xs tabular-nums">
                {module.outgoingDependencyCount} out · {module.incomingDependencyCount} in
              </span>
            </span>
            <span className="block text-xs">
              {module.fileCount} files · {module.symbolCount} symbols ·{' '}
              {module.languages.join(', ') || 'no language recorded'}
            </span>
            {module.unresolvedRelationCount > 0 || module.externalRelationCount > 0 ? (
              <span className="block text-xs">
                {module.unresolvedRelationCount} unresolved · {module.externalRelationCount}{' '}
                external
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
