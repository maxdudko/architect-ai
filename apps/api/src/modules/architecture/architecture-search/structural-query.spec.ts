import { SymbolRelationType } from '@prisma/client';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import type { ArchitectureModuleNode } from '../dependency-mapping/types/dependency-graph.type';
import { queryModuleNeighborhood } from './structural-query';

function moduleNode(key: string): ArchitectureModuleNode {
  return {
    key,
    name: key,
    path: key,
    fileCount: 2,
    symbolCount: 1,
    languages: ['typescript'],
    outgoingDependencyCount: 1,
    incomingDependencyCount: 1,
    internalRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    significance: 4,
  };
}

function edge(from: string, to: string, count: number) {
  return {
    fromModuleKey: from,
    toModuleKey: to,
    relationTypes: [SymbolRelationType.IMPORTS],
    supportingRelationCount: count,
    confidence: 'RESOLVED' as const,
    evidence: [
      {
        sourceFilePath: `${from}/a.ts`,
        targetFilePath: `${to}/b.ts`,
        relationType: SymbolRelationType.IMPORTS,
        observedTarget: './b',
        targetName: 'b',
        strategy: 'RELATIVE_PATH' as const,
      },
    ],
    evidenceTruncated: false,
  };
}

function graph(edges: ReturnType<typeof edge>[]): DependencyGraph {
  return {
    repositoryId: 'repo-1',
    indexingRunId: 'run-1',
    modules: ['src/billing', 'src/features', 'src/api'].map(moduleNode),
    filePathsByModule: {},
    dependencies: edges,
    unresolved: [],
    external: [],
    exclusions: [],
    nonDependencyRelationCounts: [],
    totals: {
      moduleCount: 3,
      dependencyCount: edges.length,
      resolvedRelationCount: edges.length,
      unresolvedRelationCount: 0,
      externalRelationCount: 0,
      internalRelationCount: 0,
      groupedFileCount: 6,
      excludedFileCount: 0,
    },
    partial: false,
    partialReasons: [],
  };
}

describe('queryModuleNeighborhood', () => {
  const dependencies = graph([
    edge('src/features', 'src/billing', 4),
    edge('src/api', 'src/billing', 1),
    edge('src/billing', 'src/api', 2),
  ]);

  it('returns modules that import the subject, ordered by supporting count', () => {
    const result = queryModuleNeighborhood(
      dependencies,
      'repo-1',
      'src/billing',
      'DEPENDENTS_OF',
    );

    expect(result.findings.map((finding) => finding.relatedModuleKey)).toEqual([
      'src/features',
      'src/api',
    ]);
    expect(
      result.findings.every((finding) => finding.direction === 'DEPENDENT'),
    ).toBe(true);
    expect(result.findings[0]?.epistemic).toBe('OBSERVED');
    expect(result.findings[0]?.evidence[0]?.filePath).toBe('src/features/a.ts');
    expect(result.dependencyBounds.total).toBe(0);
    expect(result.dependentBounds).toEqual({
      limit: 25,
      returned: 2,
      total: 2,
      truncated: false,
    });
  });

  it('keeps both directions distinct for a connected-to question', () => {
    const result = queryModuleNeighborhood(
      dependencies,
      'repo-1',
      'src/billing',
      'CONNECTED_TO',
    );

    expect(result.findings.map((finding) => finding.direction)).toEqual([
      'DEPENDENCY',
      'DEPENDENT',
      'DEPENDENT',
    ]);
  });

  it('discloses a truncated dependent list at the declared bound', () => {
    const many = graph(
      Array.from({ length: 30 }, (_, index) =>
        edge(`src/extra-${index}`, 'src/billing', 30 - index),
      ),
    );
    many.modules.push(
      ...Array.from({ length: 30 }, (_, index) =>
        moduleNode(`src/extra-${index}`),
      ),
    );

    const result = queryModuleNeighborhood(
      many,
      'repo-1',
      'src/billing',
      'MODULE_REFERENCES',
    );

    expect(result.findings).toHaveLength(25);
    expect(result.dependentBounds).toEqual({
      limit: 25,
      returned: 25,
      total: 30,
      truncated: true,
    });
    expect(result.findings[0]?.supportingRelationCount).toBe(30);
  });
});
