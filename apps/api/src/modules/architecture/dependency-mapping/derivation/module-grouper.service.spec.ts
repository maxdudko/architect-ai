import type {
  ArchitectureSnapshotFile,
  ArchitectureSnapshotSymbolCount,
} from '../types/architecture-snapshot.type';
import { ModuleGrouperService, moduleKeyFor } from './module-grouper.service';

function file(
  path: string,
  language = 'typescript',
  lineCount = 20,
): ArchitectureSnapshotFile {
  return { path, language, lineCount };
}

function symbols(
  entries: Array<[string, number]>,
): ArchitectureSnapshotSymbolCount[] {
  return entries.map(([filePath, count]) => ({ filePath, count }));
}

describe('moduleKeyFor', () => {
  it('uses at most two leading path segments', () => {
    expect(moduleKeyFor('src/features/auth/service.ts')).toBe('src/features');
    expect(moduleKeyFor('src/features/auth.ts')).toBe('src/features');
    expect(moduleKeyFor('src/app.ts')).toBe('src');
    expect(moduleKeyFor('package.json')).toBe('.');
  });
});

describe('ModuleGrouperService', () => {
  const service = new ModuleGrouperService();

  it('groups files by folder prefix and counts their inventory', () => {
    const result = service.group(
      [
        file('src/features/auth/service.ts'),
        file('src/features/auth/controller.ts'),
        file('src/features/billing/service.ts'),
        file('src/shared/logger.ts'),
        file('src/shared/config.ts'),
      ],
      symbols([
        ['src/features/auth/service.ts', 4],
        ['src/features/auth/controller.ts', 2],
        ['src/features/billing/service.ts', 3],
        ['src/shared/logger.ts', 1],
        ['src/shared/config.ts', 1],
      ]),
    );

    expect(result.modules.map((module) => module.key)).toEqual([
      'src/features',
      'src/shared',
    ]);

    const features = result.modules[0];
    expect(features.fileCount).toBe(3);
    expect(features.symbolCount).toBe(9);
    expect(features.name).toBe('Features');
    expect(result.groupedFileCount).toBe(5);
    expect(result.excludedFileCount).toBe(0);
  });

  it('excludes folders matching the stated pattern and reports the count', () => {
    const result = service.group(
      [
        file('src/app/main.ts'),
        file('src/app/boot.ts'),
        file('src/__tests__/main.spec.ts'),
        file('src/__tests__/boot.spec.ts'),
        file('node_modules/left-pad/index.js'),
        file('node_modules/left-pad/other.js'),
      ],
      symbols([]),
    );

    expect(result.modules.map((module) => module.key)).toEqual(['src/app']);
    expect(result.excludedFileCount).toBe(4);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining('excluded pattern'),
        fileCount: 4,
      }),
    ]);
  });

  it('drops folders below the minimum file count with a stated reason', () => {
    const result = service.group(
      [
        file('src/app/main.ts'),
        file('src/app/boot.ts'),
        file('docs/readme.ts'),
      ],
      symbols([]),
    );

    expect(result.modules.map((module) => module.key)).toEqual(['src/app']);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining('fewer than'),
        fileCount: 1,
      }),
    ]);
  });

  it('collects the languages present in a module', () => {
    const result = service.group(
      [
        file('src/app/main.ts', 'typescript'),
        file('src/app/legacy.js', 'javascript'),
        file('src/app/script.py', 'python'),
      ],
      symbols([]),
    );

    expect(result.modules[0].languages).toEqual([
      'javascript',
      'python',
      'typescript',
    ]);
  });

  it('produces the same grouping regardless of input order', () => {
    const files = [
      file('src/features/auth/service.ts'),
      file('src/features/billing/service.ts'),
      file('src/shared/logger.ts'),
      file('src/shared/config.ts'),
    ];

    const forward = service.group(files, symbols([]));
    const reversed = service.group([...files].reverse(), symbols([]));

    expect(forward.modules).toEqual(reversed.modules);
  });

  it('maps every grouped file to exactly one module', () => {
    const result = service.group(
      [
        file('src/app/main.ts'),
        file('src/app/boot.ts'),
        file('src/app/nested/deep.ts'),
      ],
      symbols([]),
    );

    expect([...result.moduleKeyByFilePath.values()]).toEqual([
      'src/app',
      'src/app',
      'src/app',
    ]);
  });

  it('returns no modules when every file is excluded', () => {
    const result = service.group(
      [file('test/one.spec.ts'), file('test/two.spec.ts')],
      symbols([]),
    );

    expect(result.modules).toEqual([]);
    expect(result.excludedFileCount).toBe(2);
  });
});
