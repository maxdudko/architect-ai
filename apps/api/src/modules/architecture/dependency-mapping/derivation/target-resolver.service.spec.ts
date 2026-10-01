import type { ArchitectureSnapshotFile } from '../types/architecture-snapshot.type';
import { RepositoryFileIndex } from './repository-file-index';
import { TargetResolverService } from './target-resolver.service';

function fileIndexFor(paths: string[]): RepositoryFileIndex {
  const files: ArchitectureSnapshotFile[] = paths.map((path) => ({
    path,
    language: path.endsWith('.py')
      ? 'python'
      : path.endsWith('.php')
        ? 'php'
        : 'typescript',
    lineCount: 10,
  }));
  return new RepositoryFileIndex(files);
}

describe('TargetResolverService', () => {
  const service = new TargetResolverService();

  describe('relationships with no recorded target path', () => {
    it('reports PHP use statements as unresolved with a stated reason', () => {
      const index = fileIndexFor([
        'src/Models/User.php',
        'src/Http/Kernel.php',
      ]);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/Http/Kernel.php',
          observedTarget: null,
          language: 'php',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'NO_TARGET_PATH_RECORDED',
      });
    });

    it('treats an empty specifier the same as a missing one', () => {
      const index = fileIndexFor(['src/a.ts', 'src/b.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/a.ts',
          observedTarget: '   ',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'NO_TARGET_PATH_RECORDED',
      });
    });
  });

  describe('relative specifiers', () => {
    it('resolves a sibling module without an extension', () => {
      const index = fileIndexFor(['src/a.ts', 'src/b.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/a.ts',
          observedTarget: './b',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'src/b.ts',
        strategy: 'RELATIVE_PATH',
      });
    });

    it('walks parent segments', () => {
      const index = fileIndexFor([
        'src/features/auth/service.ts',
        'src/shared/logger.ts',
      ]);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/features/auth/service.ts',
          observedTarget: '../../shared/logger',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'src/shared/logger.ts',
        strategy: 'RELATIVE_PATH',
      });
    });

    it('resolves a directory specifier through its index file', () => {
      const index = fileIndexFor(['src/app.ts', 'src/auth/index.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: './auth',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'src/auth/index.ts',
        strategy: 'RELATIVE_PATH',
      });
    });

    it('reports a relative path that matches no indexed file', () => {
      const index = fileIndexFor(['src/a.ts', 'src/b.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/a.ts',
          observedTarget: './missing',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'RELATIVE_PATH_NOT_FOUND',
      });
    });
  });

  describe('alias and bare specifiers', () => {
    it('resolves an alias by unique path suffix', () => {
      const index = fileIndexFor([
        'src/app.ts',
        'src/features/auth/index.ts',
        'src/features/billing/index.ts',
      ]);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: '@/features/auth',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'src/features/auth/index.ts',
        strategy: 'PATH_SUFFIX',
      });
    });

    it('reports an alias that matches nothing', () => {
      const index = fileIndexFor(['src/app.ts', 'src/features/auth/index.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: '@/features/missing',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'ALIAS_UNRESOLVED',
      });
    });

    it('refuses to pick between several suffix matches', () => {
      const index = fileIndexFor([
        'src/app.ts',
        'packages/one/utils/format.ts',
        'packages/two/utils/format.ts',
      ]);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: 'utils/format',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'AMBIGUOUS_MATCH',
      });
    });

    it('classifies a published package as external', () => {
      const index = fileIndexFor(['src/app.ts', 'src/b.ts']);

      expect(
        service.resolve(
          {
            sourceFilePath: 'src/app.ts',
            observedTarget: 'lodash',
            language: 'typescript',
          },
          index,
        ),
      ).toEqual({ kind: 'EXTERNAL', targetName: 'lodash' });

      expect(
        service.resolve(
          {
            sourceFilePath: 'src/app.ts',
            observedTarget: '@nestjs/common',
            language: 'typescript',
          },
          index,
        ),
      ).toEqual({ kind: 'EXTERNAL', targetName: '@nestjs/common' });

      expect(
        service.resolve(
          {
            sourceFilePath: 'src/app.ts',
            observedTarget: 'node:fs',
            language: 'typescript',
          },
          index,
        ),
      ).toEqual({ kind: 'EXTERNAL', targetName: 'node:fs' });
    });

    it('does not let a single-segment package name match a local file', () => {
      const index = fileIndexFor(['src/app.ts', 'src/uuid.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: 'uuid',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({ kind: 'EXTERNAL', targetName: 'uuid' });
    });

    it('reports an internal-looking path that matches no file as an unresolved alias', () => {
      const index = fileIndexFor(['src/app.ts', 'src/b.ts']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'src/app.ts',
          observedTarget: 'src/does/not/exist',
          language: 'typescript',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'UNRESOLVED',
        reason: 'ALIAS_UNRESOLVED',
      });
    });
  });

  describe('python module paths', () => {
    it('resolves a dotted module against the repository root', () => {
      const index = fileIndexFor(['app/views.py', 'app/models.py']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'app/views.py',
          observedTarget: 'app.models',
          language: 'python',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'app/models.py',
        strategy: 'PYTHON_MODULE_PATH',
      });
    });

    it('resolves a package through its __init__ file', () => {
      const index = fileIndexFor(['app/views.py', 'app/core/__init__.py']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'app/views.py',
          observedTarget: 'app.core',
          language: 'python',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'app/core/__init__.py',
        strategy: 'PYTHON_MODULE_PATH',
      });
    });

    it('resolves a package relative import', () => {
      const index = fileIndexFor(['app/views.py', 'app/models.py']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'app/views.py',
          observedTarget: '.models',
          language: 'python',
        },
        index,
      );

      expect(resolution).toEqual({
        kind: 'RESOLVED',
        filePath: 'app/models.py',
        strategy: 'PYTHON_MODULE_PATH',
      });
    });

    it('falls through to external for a third-party dotted module', () => {
      const index = fileIndexFor(['app/views.py', 'app/models.py']);

      const resolution = service.resolve(
        {
          sourceFilePath: 'app/views.py',
          observedTarget: 'django.db',
          language: 'python',
        },
        index,
      );

      expect(resolution).toEqual({ kind: 'EXTERNAL', targetName: 'django.db' });
    });
  });

  it('is deterministic for the same revision', () => {
    const paths = [
      'src/app.ts',
      'src/features/auth/index.ts',
      'src/features/billing/index.ts',
    ];

    const first = service.resolve(
      {
        sourceFilePath: 'src/app.ts',
        observedTarget: '@/features/auth',
        language: 'typescript',
      },
      fileIndexFor(paths),
    );
    const second = service.resolve(
      {
        sourceFilePath: 'src/app.ts',
        observedTarget: '@/features/auth',
        language: 'typescript',
      },
      fileIndexFor([...paths].reverse()),
    );

    expect(first).toEqual(second);
  });
});
