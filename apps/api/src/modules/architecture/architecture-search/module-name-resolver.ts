import { ARCHITECTURE_SEARCH_LIMITS } from './architecture-search.constants';
import type { ArchitectureModuleNode } from '../dependency-mapping/types/dependency-graph.type';

export interface ResolvedModuleRef {
  key: string;
  name: string;
  path: string;
}

export type ModuleNameResolution =
  | { outcome: 'RESOLVED'; module: ResolvedModuleRef }
  | {
      outcome: 'AMBIGUOUS';
      candidates: ResolvedModuleRef[];
      total: number;
    }
  | { outcome: 'NOT_FOUND'; nearCandidates: ResolvedModuleRef[] };

/**
 * Matches a name the user typed to modules in one revision.
 * Exact and case-insensitive against key, path, humanized name, and the
 * last path segment. A unique file path or file name is also accepted.
 * The match is never upgraded by similarity.
 */
export function resolveModuleName(
  modules: ArchitectureModuleNode[],
  rawName: string,
  filePathsByModule: Record<string, string[]> = {},
): ModuleNameResolution {
  const query = rawName.trim().toLowerCase();
  if (!query) {
    return { outcome: 'NOT_FOUND', nearCandidates: [] };
  }

  const exact = modules.filter((module) => moduleMatchesQuery(module, query));
  if (exact.length === 1) {
    return { outcome: 'RESOLVED', module: toRef(exact[0]) };
  }
  if (exact.length > 1) {
    return ambiguous(exact);
  }

  const byFile = modulesMatchingFile(modules, filePathsByModule, query);
  if (byFile.length === 1) {
    return { outcome: 'RESOLVED', module: toRef(byFile[0]) };
  }
  if (byFile.length > 1) {
    return ambiguous(byFile);
  }

  const near = modules
    .filter((module) => moduleHaystack(module).includes(query))
    .slice(0, ARCHITECTURE_SEARCH_LIMITS.nearCandidates)
    .map(toRef);

  return { outcome: 'NOT_FOUND', nearCandidates: near };
}

function moduleMatchesQuery(
  module: ArchitectureModuleNode,
  query: string,
): boolean {
  const key = module.key.toLowerCase();
  const lastSegment = key.split('/').at(-1) ?? key;
  return (
    query === key ||
    query === module.path.toLowerCase() ||
    query === module.name.toLowerCase() ||
    query === lastSegment
  );
}

function modulesMatchingFile(
  modules: ArchitectureModuleNode[],
  filePathsByModule: Record<string, string[]>,
  query: string,
): ArchitectureModuleNode[] {
  const byKey = new Map(modules.map((module) => [module.key, module]));
  const matched: ArchitectureModuleNode[] = [];

  for (const [key, paths] of Object.entries(filePathsByModule)) {
    const module = byKey.get(key);
    if (!module) {
      continue;
    }
    const hit = paths.some((path) => fileMatchesQuery(path, query));
    if (hit) {
      matched.push(module);
    }
  }

  return matched;
}

function fileMatchesQuery(path: string, query: string): boolean {
  const normalized = path.toLowerCase();
  const base = normalized.split('/').at(-1) ?? normalized;
  return (
    normalized === query || base === query || normalized.endsWith(`/${query}`)
  );
}

function moduleHaystack(module: ArchitectureModuleNode): string {
  return `${module.key} ${module.path} ${module.name}`.toLowerCase();
}

function ambiguous(modules: ArchitectureModuleNode[]): ModuleNameResolution {
  return {
    outcome: 'AMBIGUOUS',
    candidates: modules
      .slice(0, ARCHITECTURE_SEARCH_LIMITS.ambiguousCandidates)
      .map(toRef),
    total: modules.length,
  };
}

function toRef(module: ArchitectureModuleNode): ResolvedModuleRef {
  return { key: module.key, name: module.name, path: module.path };
}
