const BACKTICK = /`([^`\n]+)`/g;

/**
 * Paths the model cited in backticks. Line ranges are stripped. Values that
 * are not repository-relative paths are ignored.
 */
export function extractCitedPaths(markdown: string): string[] {
  const paths = new Set<string>();
  for (const match of markdown.matchAll(BACKTICK)) {
    const raw = match[1]?.trim() ?? '';
    const withoutRange = raw.replace(/:\d+(?:-\d+)?$/, '');
    if (isRepositoryPath(withoutRange)) {
      paths.add(withoutRange);
    }
  }
  return [...paths].sort();
}

export function missingCitedPaths(
  cited: string[],
  existing: readonly string[],
): string[] {
  const known = new Set(existing);
  return cited.filter((path) => !known.has(path));
}

/**
 * A cited path is grounded when it is an indexed file, or a directory that
 * contains an indexed file. A shorter prefix such as `apps/ap` does not cover
 * `apps/api/...`.
 */
export function coveredCitedPaths(
  cited: readonly string[],
  indexedFiles: readonly string[],
): string[] {
  return cited.filter((path) =>
    indexedFiles.some((file) => file === path || file.startsWith(`${path}/`)),
  );
}

function isRepositoryPath(value: string): boolean {
  if (!value || value.includes(' ') || value.includes('://')) {
    return false;
  }
  if (
    value.startsWith('/') ||
    value.startsWith('.') ||
    value.startsWith('@') ||
    value.includes('..')
  ) {
    return false;
  }
  if (value.includes('/')) {
    return true;
  }
  // `package.json` and `README.md` are files. `Next.js` is a product name.
  if (/^[A-Z][a-z0-9]*\.[a-z0-9]+$/.test(value)) {
    return false;
  }
  return /\.[a-z0-9]+$/i.test(value);
}
