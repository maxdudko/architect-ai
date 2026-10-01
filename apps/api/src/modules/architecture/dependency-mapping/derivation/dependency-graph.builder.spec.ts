import { SymbolRelationType } from '@prisma/client';
import { DEPENDENCY_MAP_LIMITS } from '../dependency-map.constants';
import type {
  ArchitectureSnapshot,
  ArchitectureSnapshotImport,
} from '../types/architecture-snapshot.type';
import { DependencyGraphBuilder } from './dependency-graph.builder';
import { ModuleGrouperService } from './module-grouper.service';
import { TargetResolverService } from './target-resolver.service';

function importRow(
  sourceFilePath: string,
  observedTarget: string | null,
  targetName: string | null = 'Thing',
): ArchitectureSnapshotImport {
  return {
    sourceFilePath,
    observedTarget,
    targetName,
    relationType: SymbolRelationType.IMPORTS,
  };
}

function snapshot(
  overrides: Partial<ArchitectureSnapshot> = {},
): ArchitectureSnapshot {
  return {
    repositoryId: 'repository-1',
    indexingRunId: 'run-1',
    files: [],
    symbolCountsByFile: [],
    imports: [],
    nonImportRelationCounts: [],
    filesTruncated: false,
    importsTruncated: false,
    ...overrides,
  };
}

const tsFiles = [
  { path: 'src/features/auth.ts', language: 'typescript', lineCount: 40 },
  { path: 'src/features/billing.ts', language: 'typescript', lineCount: 30 },
  { path: 'src/shared/logger.ts', language: 'typescript', lineCount: 20 },
  { path: 'src/shared/config.ts', language: 'typescript', lineCount: 15 },
];

describe('DependencyGraphBuilder', () => {
  const builder = new DependencyGraphBuilder(
    new ModuleGrouperService(),
    new TargetResolverService(),
  );

  it('derives a directed dependency between two modules with evidence', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [
          importRow('src/features/auth.ts', '../shared/logger', 'logger'),
        ],
      }),
    );

    expect(graph.dependencies).toHaveLength(1);
    const [dependency] = graph.dependencies;
    expect(dependency.fromModuleKey).toBe('src/features');
    expect(dependency.toModuleKey).toBe('src/shared');
    expect(dependency.confidence).toBe('RESOLVED');
    expect(dependency.supportingRelationCount).toBe(1);
    expect(dependency.relationTypes).toEqual([SymbolRelationType.IMPORTS]);
    expect(dependency.evidence).toEqual([
      {
        sourceFilePath: 'src/features/auth.ts',
        targetFilePath: 'src/shared/logger.ts',
        relationType: SymbolRelationType.IMPORTS,
        observedTarget: '../shared/logger',
        targetName: 'logger',
        strategy: 'RELATIVE_PATH',
      },
    ]);
  });

  it('does not inflate supporting counts when one import names several identifiers', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [
          importRow('src/features/auth.ts', '../shared/logger', 'logger'),
          importRow('src/features/auth.ts', '../shared/logger', 'LogLevel'),
          importRow('src/features/auth.ts', '../shared/logger', 'createLogger'),
        ],
      }),
    );

    expect(graph.dependencies).toHaveLength(1);
    expect(graph.dependencies[0].supportingRelationCount).toBe(1);
  });

  it('counts distinct source files as separate supporting relationships', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [
          importRow('src/features/auth.ts', '../shared/logger'),
          importRow('src/features/billing.ts', '../shared/config'),
        ],
      }),
    );

    expect(graph.dependencies).toHaveLength(1);
    expect(graph.dependencies[0].supportingRelationCount).toBe(2);
    expect(graph.dependencies[0].evidence).toHaveLength(2);
  });

  it('treats a target in the same module as internal activity, not a dependency', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [importRow('src/features/auth.ts', './billing')],
      }),
    );

    expect(graph.dependencies).toHaveLength(0);
    expect(graph.totals.internalRelationCount).toBe(1);
    const features = graph.modules.find(
      (module) => module.key === 'src/features',
    );
    expect(features?.internalRelationCount).toBe(1);
  });

  it('records both directions when two modules depend on each other', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [
          importRow('src/features/auth.ts', '../shared/logger'),
          importRow('src/shared/config.ts', '../features/billing'),
        ],
      }),
    );

    expect(
      graph.dependencies.map((edge) => [edge.fromModuleKey, edge.toModuleKey]),
    ).toEqual(
      expect.arrayContaining([
        ['src/features', 'src/shared'],
        ['src/shared', 'src/features'],
      ]),
    );
  });

  it('reports unresolved relationships with their observed target and reason', () => {
    const graph = builder.build(
      snapshot({
        files: [
          { path: 'src/Http/Kernel.php', language: 'php', lineCount: 30 },
          { path: 'src/Http/Router.php', language: 'php', lineCount: 20 },
          { path: 'src/Models/User.php', language: 'php', lineCount: 25 },
          { path: 'src/Models/Order.php', language: 'php', lineCount: 25 },
        ],
        imports: [importRow('src/Http/Kernel.php', null, 'App\\Models\\User')],
      }),
    );

    expect(graph.dependencies).toHaveLength(0);
    expect(graph.unresolved).toEqual([
      {
        moduleKey: 'src/Http',
        sourceFilePath: 'src/Http/Kernel.php',
        observedTarget: null,
        targetName: 'App\\Models\\User',
        relationType: SymbolRelationType.IMPORTS,
        reason: 'NO_TARGET_PATH_RECORDED',
        occurrenceCount: 1,
      },
    ]);
  });

  it('keeps distinct target names for relationships with no recorded path', () => {
    const graph = builder.build(
      snapshot({
        files: [
          { path: 'src/Http/Kernel.php', language: 'php', lineCount: 30 },
          { path: 'src/Http/Router.php', language: 'php', lineCount: 20 },
        ],
        imports: [
          importRow('src/Http/Kernel.php', null, 'App\\Models\\User'),
          importRow('src/Http/Kernel.php', null, 'App\\Models\\Order'),
        ],
      }),
    );

    expect(graph.unresolved).toHaveLength(2);
    expect(graph.unresolved.map((record) => record.targetName).sort()).toEqual([
      'App\\Models\\Order',
      'App\\Models\\User',
    ]);
  });

  it('summarises external targets without turning them into modules', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [
          importRow('src/features/auth.ts', 'lodash'),
          importRow('src/features/billing.ts', 'lodash'),
        ],
      }),
    );

    expect(graph.modules.map((module) => module.key)).toEqual([
      'src/features',
      'src/shared',
    ]);
    expect(graph.external).toEqual([
      {
        moduleKey: 'src/features',
        targetName: 'lodash',
        relationType: SymbolRelationType.IMPORTS,
        occurrenceCount: 2,
      },
    ]);
    expect(graph.dependencies).toHaveLength(0);
  });

  it('reports a resolved target whose module was excluded as unresolved', () => {
    const graph = builder.build(
      snapshot({
        files: [
          ...tsFiles,
          { path: 'src/__tests__/a.ts', language: 'typescript', lineCount: 5 },
          { path: 'src/__tests__/b.ts', language: 'typescript', lineCount: 5 },
        ],
        imports: [importRow('src/features/auth.ts', '../__tests__/a')],
      }),
    );

    expect(graph.dependencies).toHaveLength(0);
    expect(graph.unresolved[0]).toEqual(
      expect.objectContaining({ reason: 'TARGET_MODULE_EXCLUDED' }),
    );
  });

  it('orders modules by significance and breaks ties by key', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        symbolCountsByFile: [
          { filePath: 'src/shared/logger.ts', count: 50 },
          { filePath: 'src/features/auth.ts', count: 1 },
        ],
      }),
    );

    expect(graph.modules.map((module) => module.key)).toEqual([
      'src/shared',
      'src/features',
    ]);
    expect(graph.modules[0].significance).toBe(52);
  });

  it('bounds evidence per dependency and discloses the truncation', () => {
    const files = [
      { path: 'src/shared/logger.ts', language: 'typescript', lineCount: 10 },
      { path: 'src/shared/config.ts', language: 'typescript', lineCount: 10 },
    ];
    const imports: ArchitectureSnapshotImport[] = [];
    const limit = DEPENDENCY_MAP_LIMITS.evidencePerDependency;

    for (let index = 0; index < limit + 5; index += 1) {
      const path = `src/features/module-${index}.ts`;
      files.push({ path, language: 'typescript', lineCount: 10 });
      imports.push(importRow(path, '../shared/logger'));
    }

    const graph = builder.build(snapshot({ files, imports }));

    const [dependency] = graph.dependencies;
    expect(dependency.supportingRelationCount).toBe(limit + 5);
    expect(dependency.evidence).toHaveLength(limit);
    expect(dependency.evidenceTruncated).toBe(true);
  });

  it('carries the truncation flags through as a partial view', () => {
    const graph = builder.build(
      snapshot({ files: tsFiles, importsTruncated: true }),
    );

    expect(graph.partial).toBe(true);
    expect(graph.partialReasons).toHaveLength(1);
    expect(graph.partialReasons[0]).toContain('truncated relationship set');
  });

  it('reports relationship types that cannot produce a dependency', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        nonImportRelationCounts: [
          { relationType: SymbolRelationType.EXTENDS, count: 12 },
          { relationType: SymbolRelationType.CALLS, count: 340 },
        ],
      }),
    );

    expect(graph.nonDependencyRelationCounts).toEqual([
      { relationType: SymbolRelationType.CALLS, count: 340 },
      { relationType: SymbolRelationType.EXTENDS, count: 12 },
    ]);
  });

  it('ignores relationships whose source file has no module', () => {
    const graph = builder.build(
      snapshot({
        files: [
          ...tsFiles,
          { path: 'src/__tests__/a.ts', language: 'typescript', lineCount: 5 },
          { path: 'src/__tests__/b.ts', language: 'typescript', lineCount: 5 },
        ],
        imports: [importRow('src/__tests__/a.ts', '../shared/logger')],
      }),
    );

    expect(graph.dependencies).toHaveLength(0);
    expect(graph.unresolved).toHaveLength(0);
  });

  it('binds every derived entity to the snapshot revision', () => {
    const graph = builder.build(
      snapshot({
        files: tsFiles,
        imports: [importRow('src/features/auth.ts', '../shared/logger')],
      }),
    );

    expect(graph.repositoryId).toBe('repository-1');
    expect(graph.indexingRunId).toBe('run-1');
  });
});
