import type { MergedTopologyHints } from '../../code-intelligence/languages/language-pack.registry';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import {
  SYSTEM_OVERVIEW_LIMITATIONS,
  SYSTEM_OVERVIEW_LIMITS,
} from './system-overview.constants';
import { collectTechnologyHints } from './technology-hints';

export interface BoundDisclosure {
  limit: number;
  returned: number;
  total: number;
  truncated: boolean;
}

export interface OverviewFacts {
  modulesAbsent: boolean;
  partial: boolean;
  partialReasons: string[];
  moduleBounds: BoundDisclosure;
  dependencyBounds: BoundDisclosure;
  unresolvedBounds: BoundDisclosure;
  externalBounds: BoundDisclosure;
  modules: Array<{
    key: string;
    name: string;
    path: string;
    fileCount: number;
    symbolCount: number;
    languages: string[];
    outgoingDependencyCount: number;
    incomingDependencyCount: number;
  }>;
  dependencies: Array<{
    fromModuleKey: string;
    toModuleKey: string;
    supportingRelationCount: number;
    relationTypes: string[];
    confidence: 'RESOLVED';
    evidencePaths: string[];
  }>;
  unresolved: Array<{
    reason: string;
    targetName: string;
    count: number;
  }>;
  external: Array<{
    targetName: string;
    count: number;
  }>;
  technologies: Array<{
    name: string;
    category: string;
    confidence: string;
    evidencePaths: string[];
    evidence: string;
  }>;
  entryPoints: Array<{
    path: string;
    confidence: string;
    evidence: string;
  }>;
  limitations: string[];
  contextTruncated: boolean;
}

/**
 * Selects a bounded structural context from one dependency graph.
 * Modules keep the graph's significance order. Dependencies are only those
 * among the selected modules.
 */
export function buildOverviewFacts(
  graph: DependencyGraph,
  files: Array<{ path: string; language: string }>,
  hints: MergedTopologyHints,
): OverviewFacts {
  const modules = graph.modules.slice(0, SYSTEM_OVERVIEW_LIMITS.modules);
  const selected = new Set(modules.map((module) => module.key));
  const amongSelected = graph.dependencies
    .filter(
      (edge) =>
        selected.has(edge.fromModuleKey) && selected.has(edge.toModuleKey),
    )
    .sort(
      (left, right) =>
        right.supportingRelationCount - left.supportingRelationCount ||
        left.fromModuleKey.localeCompare(right.fromModuleKey) ||
        left.toModuleKey.localeCompare(right.toModuleKey),
    );
  const dependencies = amongSelected.slice(
    0,
    SYSTEM_OVERVIEW_LIMITS.dependencies,
  );

  const unresolvedGroups = new Map<
    string,
    { reason: string; targetName: string; count: number }
  >();
  for (const record of graph.unresolved) {
    if (!selected.has(record.moduleKey) && modules.length > 0) {
      continue;
    }
    const targetName = record.observedTarget ?? record.targetName ?? 'unknown';
    const key = `${record.reason}:${targetName}`;
    const current = unresolvedGroups.get(key);
    if (current) {
      current.count += record.occurrenceCount;
    } else {
      unresolvedGroups.set(key, {
        reason: record.reason,
        targetName,
        count: record.occurrenceCount,
      });
    }
  }
  const unresolvedSorted = [...unresolvedGroups.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.targetName.localeCompare(right.targetName),
  );

  const externalGroups = new Map<string, number>();
  for (const record of graph.external) {
    if (!selected.has(record.moduleKey) && modules.length > 0) {
      continue;
    }
    externalGroups.set(
      record.targetName,
      (externalGroups.get(record.targetName) ?? 0) + record.occurrenceCount,
    );
  }
  const externalSorted = [...externalGroups.entries()]
    .map(([targetName, count]) => ({ targetName, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.targetName.localeCompare(right.targetName),
    );

  const technology = collectTechnologyHints(files, hints);
  const limitations: string[] = [...SYSTEM_OVERVIEW_LIMITATIONS];
  if (graph.partial) {
    limitations.push(...graph.partialReasons);
  }

  return {
    modulesAbsent: graph.modules.length === 0,
    partial: graph.partial,
    partialReasons: graph.partialReasons,
    moduleBounds: bounds(
      SYSTEM_OVERVIEW_LIMITS.modules,
      modules.length,
      graph.modules.length,
    ),
    dependencyBounds: bounds(
      SYSTEM_OVERVIEW_LIMITS.dependencies,
      dependencies.length,
      amongSelected.length,
    ),
    unresolvedBounds: bounds(
      SYSTEM_OVERVIEW_LIMITS.unresolvedSummaries,
      Math.min(
        unresolvedSorted.length,
        SYSTEM_OVERVIEW_LIMITS.unresolvedSummaries,
      ),
      unresolvedSorted.length,
    ),
    externalBounds: bounds(
      SYSTEM_OVERVIEW_LIMITS.externalSummaries,
      Math.min(externalSorted.length, SYSTEM_OVERVIEW_LIMITS.externalSummaries),
      externalSorted.length,
    ),
    modules: modules.map((module) => ({
      key: module.key,
      name: module.name,
      path: module.path,
      fileCount: module.fileCount,
      symbolCount: module.symbolCount,
      languages: module.languages,
      outgoingDependencyCount: module.outgoingDependencyCount,
      incomingDependencyCount: module.incomingDependencyCount,
    })),
    dependencies: dependencies.map((edge) => ({
      fromModuleKey: edge.fromModuleKey,
      toModuleKey: edge.toModuleKey,
      supportingRelationCount: edge.supportingRelationCount,
      relationTypes: edge.relationTypes,
      confidence: 'RESOLVED',
      evidencePaths: [
        ...new Set(edge.evidence.map((item) => item.sourceFilePath)),
      ].slice(0, SYSTEM_OVERVIEW_LIMITS.evidencePathsPerDependency),
    })),
    unresolved: unresolvedSorted.slice(
      0,
      SYSTEM_OVERVIEW_LIMITS.unresolvedSummaries,
    ),
    external: externalSorted.slice(0, SYSTEM_OVERVIEW_LIMITS.externalSummaries),
    technologies: technology.technologies,
    entryPoints: technology.entryPoints,
    limitations,
    contextTruncated: false,
  };
}

/**
 * Shrinks facts until the JSON fits the declared budget. Truncation is
 * recorded on the facts themselves so the prompt and the document can say so.
 */
export function fitOverviewFacts(facts: OverviewFacts): OverviewFacts {
  const working = structuredClone(facts);
  const encode = () => JSON.stringify(working);
  if (encode().length <= SYSTEM_OVERVIEW_LIMITS.structuredFactsChars) {
    return working;
  }

  working.contextTruncated = true;
  working.limitations.push(
    'Structured architecture facts were truncated to fit the context budget. The shown subset is not a complete inventory.',
  );

  while (encode().length > SYSTEM_OVERVIEW_LIMITS.structuredFactsChars) {
    if (working.dependencies.length > 0) {
      working.dependencies.pop();
      working.dependencyBounds = {
        ...working.dependencyBounds,
        returned: working.dependencies.length,
        truncated: true,
      };
      continue;
    }
    if (working.unresolved.length > 0) {
      working.unresolved.pop();
      working.unresolvedBounds = {
        ...working.unresolvedBounds,
        returned: working.unresolved.length,
        truncated: true,
      };
      continue;
    }
    if (working.external.length > 0) {
      working.external.pop();
      working.externalBounds = {
        ...working.externalBounds,
        returned: working.external.length,
        truncated: true,
      };
      continue;
    }
    if (working.technologies.length > 0) {
      working.technologies.pop();
      continue;
    }
    if (working.entryPoints.length > 0) {
      working.entryPoints.pop();
      continue;
    }
    if (working.modules.length > 1) {
      working.modules.pop();
      working.moduleBounds = {
        ...working.moduleBounds,
        returned: working.modules.length,
        truncated: true,
      };
      continue;
    }
    working.limitations = [
      'Structured architecture facts were truncated to fit the context budget. The shown subset is not a complete inventory.',
    ];
    working.modules = working.modules.slice(0, 1).map((module) => ({
      ...module,
      name: module.name.slice(0, 80),
      path: module.path.slice(0, 120),
    }));
    break;
  }

  return working;
}

function bounds(
  limit: number,
  returned: number,
  total: number,
): BoundDisclosure {
  return {
    limit,
    returned,
    total,
    truncated: total > returned,
  };
}
