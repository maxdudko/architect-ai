import type { ArchitectureSnapshotFile } from '../types/architecture-snapshot.type';

/** Extensions tried when an import specifier carries no file extension. */
const CANDIDATE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.php',
];

/** Files tried when a specifier points at a directory. */
const DIRECTORY_INDEX_BASENAMES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.cjs',
  '__init__.py',
];

/** Upper bound on how many trailing segments participate in suffix matching. */
const MAX_SUFFIX_SEGMENTS = 6;

/**
 * Lookup structures over the indexed files of one revision. Built once per
 * derivation so resolution stays a constant-time map lookup per relationship.
 */
export class RepositoryFileIndex {
  private readonly paths: Set<string>;
  private readonly rootSegments: Set<string>;
  private readonly suffixes = new Map<string, Set<string>>();

  constructor(files: ArchitectureSnapshotFile[]) {
    this.paths = new Set(files.map((file) => file.path));
    this.rootSegments = new Set(
      files.map((file) => file.path.split('/')[0]).filter(Boolean),
    );

    for (const file of files) {
      const normalized = normalizeForMatching(file.path);
      const segments = normalized.split('/');
      const depth = Math.min(segments.length, MAX_SUFFIX_SEGMENTS);
      for (let taken = 1; taken <= depth; taken += 1) {
        const suffix = segments.slice(segments.length - taken).join('/');
        const bucket = this.suffixes.get(suffix);
        if (bucket) {
          bucket.add(file.path);
        } else {
          this.suffixes.set(suffix, new Set([file.path]));
        }
      }
    }
  }

  has(path: string): boolean {
    return this.paths.has(path);
  }

  hasRootSegment(segment: string): boolean {
    return this.rootSegments.has(segment);
  }

  /**
   * Resolve a repository-rooted path that may omit its extension or point at a
   * directory. Candidates are tried in a fixed order so the result is
   * deterministic for a revision.
   */
  resolvePath(candidatePath: string): string | null {
    if (this.paths.has(candidatePath)) {
      return candidatePath;
    }

    for (const extension of CANDIDATE_EXTENSIONS) {
      const withExtension = `${candidatePath}${extension}`;
      if (this.paths.has(withExtension)) {
        return withExtension;
      }
    }

    for (const basename of DIRECTORY_INDEX_BASENAMES) {
      const indexPath = `${candidatePath}/${basename}`;
      if (this.paths.has(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Match a specifier against the trailing segments of indexed file paths.
   * Returns every match so an ambiguous specifier can be reported rather than
   * silently resolved to an arbitrary file (spec RS-4).
   */
  matchSuffix(specifier: string): string[] {
    const normalized = normalizeForMatching(specifier);
    const matches = this.suffixes.get(normalized);
    if (!matches) {
      return [];
    }
    return [...matches].sort();
  }
}

/**
 * Strip the file extension and a trailing directory-index basename so that
 * `src/auth/index.ts`, `src/auth.ts` and the specifier `src/auth` share a key.
 */
export function normalizeForMatching(value: string): string {
  let normalized = value.replace(/^\.\//, '').replace(/\/+$/, '');

  for (const basename of DIRECTORY_INDEX_BASENAMES) {
    if (normalized.endsWith(`/${basename}`)) {
      return normalized.slice(0, -(basename.length + 1));
    }
    if (normalized === basename) {
      return normalized;
    }
  }

  const lastSlash = normalized.lastIndexOf('/');
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot > lastSlash + 1) {
    const extension = normalized.slice(lastDot);
    if (CANDIDATE_EXTENSIONS.includes(extension)) {
      normalized = normalized.slice(0, lastDot);
    }
  }

  return normalized;
}

/** Resolve `.` and `..` segments against the directory of the source file. */
export function joinRelative(
  sourceFilePath: string,
  specifier: string,
): string | null {
  const baseSegments = sourceFilePath.split('/').slice(0, -1);
  const resolved: string[] = [...baseSegments];

  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (resolved.length === 0) {
        return null;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.length > 0 ? resolved.join('/') : null;
}
