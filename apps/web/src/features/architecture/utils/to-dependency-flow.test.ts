import { describe, expect, it } from 'vitest';
import type { ArchitectureModuleSummary, DependencyMapEdge } from '@/entities';
import { toDependencyFlow } from './to-dependency-flow';

function moduleSummary(
  path: string,
  fileCount: number,
  overrides: Partial<ArchitectureModuleSummary> = {},
): ArchitectureModuleSummary {
  return {
    key: path,
    name: path,
    path,
    fileCount,
    symbolCount: fileCount,
    languages: ['typescript'],
    outgoingDependencyCount: 0,
    incomingDependencyCount: 0,
    internalRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    significance: fileCount,
    ...overrides,
  };
}

function edge(from: string, to: string, supportingRelationCount = 1): DependencyMapEdge {
  return {
    fromModuleKey: from,
    toModuleKey: to,
    relationTypes: ['IMPORTS'],
    supportingRelationCount,
    confidence: 'RESOLVED',
  };
}

const base = {
  filter: '',
  selectedModuleKey: null,
  files: [],
  fileBounds: null,
};

describe('toDependencyFlow', () => {
  it('groups modules by their first path segment and stacks them inside the group', () => {
    const flow = toDependencyFlow({
      ...base,
      modules: [
        moduleSummary('packages/ui', 2),
        moduleSummary('apps/api', 40),
        moduleSummary('apps/web', 10),
      ],
      dependencies: [],
    });

    const groups = flow.nodes.filter((node) => node.kind === 'group');
    expect(groups.map((node) => node.data)).toEqual([
      { kind: 'group', label: 'apps' },
      { kind: 'group', label: 'packages' },
    ]);
    expect(groups[1].position.x).toBeGreaterThan(groups[0].position.x);

    const appModules = flow.nodes.filter(
      (node) => node.kind === 'module' && node.parentId === 'group:apps',
    );
    expect(appModules.map((node) => node.id)).toEqual(['module:apps/api', 'module:apps/web']);
    expect(appModules[1].position.y).toBeGreaterThan(appModules[0].position.y);
    expect(flow.edges).toEqual([]);
  });

  it('makes a module with more files taller than a smaller sibling', () => {
    const flow = toDependencyFlow({
      ...base,
      modules: [moduleSummary('apps/api', 400), moduleSummary('apps/web', 20)],
      dependencies: [],
    });

    const api = flow.nodes.find((node) => node.id === 'module:apps/api');
    const web = flow.nodes.find((node) => node.id === 'module:apps/web');
    expect(api).toBeDefined();
    expect(web).toBeDefined();
    expect(api!.height).toBeGreaterThan(web!.height);
  });

  it('draws an edge only when both modules remain visible', () => {
    const flow = toDependencyFlow({
      ...base,
      modules: [moduleSummary('apps/api', 10), moduleSummary('packages/shared', 4)],
      dependencies: [edge('apps/api', 'packages/shared', 6)],
    });

    expect(flow.edges).toEqual([
      {
        id: 'apps/api::packages/shared',
        source: 'module:apps/api',
        target: 'module:packages/shared',
        label: '6',
        fromModuleKey: 'apps/api',
        toModuleKey: 'packages/shared',
      },
    ]);
  });

  it('hides modules that miss the filter and drops edges that touched them', () => {
    const flow = toDependencyFlow({
      ...base,
      filter: 'web',
      modules: [
        moduleSummary('apps/api', 10),
        moduleSummary('apps/web', 8),
        moduleSummary('packages/ui', 2),
      ],
      dependencies: [edge('apps/web', 'packages/ui'), edge('apps/api', 'packages/ui')],
    });

    expect(flow.nodes.filter((node) => node.kind === 'module').map((node) => node.id)).toEqual([
      'module:apps/web',
    ]);
    expect(flow.nodes.some((node) => node.id === 'group:packages')).toBe(false);
    expect(flow.edges).toEqual([]);
  });

  it('nests the selected module files by the next folder segment', () => {
    const flow = toDependencyFlow({
      ...base,
      modules: [moduleSummary('apps/api', 4)],
      dependencies: [],
      selectedModuleKey: 'apps/api',
      files: [
        { path: 'apps/api/package.json', language: 'json', lineCount: 10 },
        { path: 'apps/api/src/main.ts', language: 'typescript', lineCount: 20 },
        { path: 'apps/api/prisma/schema.prisma', language: 'prisma', lineCount: 40 },
        { path: 'apps/api/src/app.module.ts', language: 'typescript', lineCount: 15 },
      ],
      fileBounds: { limit: 50, returned: 4, total: 4, truncated: false },
    });

    const moduleNode = flow.nodes.find((node) => node.id === 'module:apps/api');
    expect(moduleNode?.data).toEqual(
      expect.objectContaining({ selected: true, filesTruncated: false }),
    );
    expect(moduleNode && moduleNode.width).toBeGreaterThan(220);

    const folders = flow.nodes.filter((node) => node.kind === 'folder');
    expect(folders.map((node) => (node.data.kind === 'folder' ? node.data.label : ''))).toEqual([
      'root',
      'prisma',
      'src',
    ]);

    const srcFiles = flow.nodes.filter((node) => node.parentId === 'folder:apps/api:src');
    expect(srcFiles.map((node) => node.id)).toEqual([
      'file:apps/api/src/main.ts',
      'file:apps/api/src/app.module.ts',
    ]);
    expect(flow.nodes.findIndex((node) => node.id === 'group:apps')).toBeLessThan(
      flow.nodes.findIndex((node) => node.id === 'module:apps/api'),
    );
  });

  it('records when the nested file list was truncated', () => {
    const flow = toDependencyFlow({
      ...base,
      modules: [moduleSummary('apps/web', 262)],
      dependencies: [],
      selectedModuleKey: 'apps/web',
      files: [{ path: 'apps/web/src/app/page.tsx', language: 'typescript', lineCount: 12 }],
      fileBounds: { limit: 50, returned: 50, total: 262, truncated: true },
    });

    const moduleNode = flow.nodes.find((node) => node.id === 'module:apps/web');
    expect(moduleNode?.data).toEqual(
      expect.objectContaining({
        filesTruncated: true,
        filesReturned: 50,
        filesTotal: 262,
      }),
    );
  });

  it('does not expand a selected module that the filter has hidden', () => {
    const flow = toDependencyFlow({
      ...base,
      filter: 'packages',
      modules: [moduleSummary('apps/api', 4)],
      dependencies: [],
      selectedModuleKey: 'apps/api',
      files: [{ path: 'apps/api/src/main.ts', language: 'typescript', lineCount: 3 }],
    });

    expect(flow.nodes).toEqual([]);
  });
});
