import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import { buildOverviewFacts, fitOverviewFacts } from './overview-facts';
import { SYSTEM_OVERVIEW_LIMITS } from './system-overview.constants';

const hints = {
  serviceSuffixes: [],
  entryFileStems: ['main'],
  entryBasenames: [],
  entryPathPatterns: [],
  highConfidenceEntryStems: ['main'],
  highConfidenceEntryBasenames: [],
  techMarkers: [
    {
      pattern: /package\.json$/,
      name: 'node',
      category: 'tooling' as const,
    },
  ],
};

function graph(moduleCount: number, dependencyCount: number): DependencyGraph {
  const modules = Array.from({ length: moduleCount }, (_, index) => ({
    key: `src/mod-${index}`,
    name: `Mod ${index}`,
    path: `src/mod-${index}`,
    fileCount: 2,
    symbolCount: index,
    languages: ['typescript'],
    outgoingDependencyCount: 0,
    incomingDependencyCount: 0,
    internalRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    significance: moduleCount - index,
  }));
  return {
    repositoryId: 'repo',
    indexingRunId: 'index',
    modules,
    filePathsByModule: {},
    dependencies: Array.from({ length: dependencyCount }, (_, index) => ({
      fromModuleKey: 'src/mod-0',
      toModuleKey: `src/mod-${(index % Math.max(moduleCount - 1, 1)) + 1}`,
      relationTypes: ['IMPORTS'],
      supportingRelationCount: dependencyCount - index,
      confidence: 'RESOLVED',
      evidence: [
        {
          sourceFilePath: 'src/mod-0/a.ts',
          targetFilePath: 'src/mod-1/b.ts',
          relationType: 'IMPORTS',
          observedTarget: './b',
          targetName: 'b',
          strategy: 'RELATIVE_PATH',
        },
      ],
      evidenceTruncated: false,
    })),
    unresolved: [],
    external: [],
    exclusions: [],
    nonDependencyRelationCounts: [],
    totals: {
      moduleCount,
      dependencyCount,
      resolvedRelationCount: dependencyCount,
      unresolvedRelationCount: 0,
      externalRelationCount: 0,
      internalRelationCount: 0,
      groupedFileCount: moduleCount * 2,
      excludedFileCount: 0,
    },
    partial: false,
    partialReasons: [],
  };
}

describe('overview facts', () => {
  it('keeps the most significant modules and dependencies among them', () => {
    const facts = buildOverviewFacts(
      graph(25, 80),
      [
        { path: 'src/mod-0/main.ts', language: 'typescript' },
        { path: 'package.json', language: 'config' },
      ],
      hints,
    );

    expect(facts.modules).toHaveLength(SYSTEM_OVERVIEW_LIMITS.modules);
    expect(facts.modules[0].key).toBe('src/mod-0');
    expect(facts.moduleBounds.truncated).toBe(true);
    expect(facts.dependencies.length).toBeLessThanOrEqual(
      SYSTEM_OVERVIEW_LIMITS.dependencies,
    );
    expect(facts.dependencyBounds.truncated).toBe(true);
    expect(facts.technologies.map((item) => item.name)).toContain('node');
    expect(facts.entryPoints.map((item) => item.path)).toContain(
      'src/mod-0/main.ts',
    );
    expect(JSON.stringify(facts)).not.toContain('majorFolders');
    expect(facts.modulesAbsent).toBe(false);
  });

  it('records a reduced basis when the revision has no modules', () => {
    const facts = buildOverviewFacts(
      graph(0, 0),
      [{ path: 'package.json', language: 'config' }],
      hints,
    );

    expect(facts.modulesAbsent).toBe(true);
    expect(facts.modules).toEqual([]);
    expect(facts.dependencies).toEqual([]);
  });

  it('marks facts truncated when the JSON exceeds the budget', () => {
    const facts = buildOverviewFacts(
      graph(20, 40),
      [{ path: 'src/mod-0/main.ts', language: 'typescript' }],
      hints,
    );
    facts.limitations = [
      'x'.repeat(SYSTEM_OVERVIEW_LIMITS.structuredFactsChars),
    ];
    const fitted = fitOverviewFacts(facts);

    expect(fitted.contextTruncated).toBe(true);
    expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(
      SYSTEM_OVERVIEW_LIMITS.structuredFactsChars + 800,
    );
  });
});
