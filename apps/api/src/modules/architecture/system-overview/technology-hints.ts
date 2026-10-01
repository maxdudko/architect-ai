import type { MergedTopologyHints } from '../../code-intelligence/languages/language-pack.registry';
import { PROGRAMMING_LANGUAGES } from '../../code-intelligence/types/programming-language.type';
import { SYSTEM_OVERVIEW_LIMITS } from './system-overview.constants';

export interface TechnologyHint {
  name: string;
  category: string;
  confidence: 'high' | 'medium';
  evidencePaths: string[];
  evidence: string;
}

export interface EntryPointHint {
  path: string;
  confidence: 'high' | 'medium';
  evidence: string;
}

/**
 * Path-pattern technology and entry-point detection. It reads only the file
 * inventory already loaded for the selected revision.
 */
export function collectTechnologyHints(
  files: Array<{ path: string; language: string }>,
  hints: MergedTopologyHints,
): { technologies: TechnologyHint[]; entryPoints: EntryPointHint[] } {
  const technologies: TechnologyHint[] = [];
  const byLanguage = new Map<string, string[]>();
  for (const file of files) {
    if (file.language === PROGRAMMING_LANGUAGES.config) {
      continue;
    }
    const paths = byLanguage.get(file.language) ?? [];
    paths.push(file.path);
    byLanguage.set(file.language, paths);
  }
  for (const [language, paths] of byLanguage) {
    technologies.push({
      name: language,
      category: 'language',
      confidence: paths.length >= 3 ? 'high' : 'medium',
      evidencePaths: paths.slice(0, 5),
      evidence: `${paths.length} indexed non-generated files report this language`,
    });
  }

  for (const marker of hints.techMarkers) {
    const paths = files
      .filter((file) => marker.pattern.test(file.path))
      .map((file) => file.path);
    if (paths.length === 0) {
      continue;
    }
    technologies.push({
      name: marker.name,
      category: marker.category,
      confidence: 'high',
      evidencePaths: paths.slice(0, 5),
      evidence: 'Detected from indexed manifest or configuration path',
    });
  }

  technologies.sort((left, right) => left.name.localeCompare(right.name));

  const entryPoints = files
    .filter((file) => isEntryPoint(file.path, hints))
    .map((file) => {
      const basename = file.path.split('/').at(-1) ?? file.path;
      return {
        path: file.path,
        confidence: isHighConfidenceEntry(basename, hints)
          ? ('high' as const)
          : ('medium' as const),
        evidence: `Indexed filename "${basename}" is a conventional entry point`,
      };
    })
    .slice(0, SYSTEM_OVERVIEW_LIMITS.entryPoints);

  return {
    technologies: technologies.slice(
      0,
      SYSTEM_OVERVIEW_LIMITS.technologyEvidence,
    ),
    entryPoints,
  };
}

function isEntryPoint(filePath: string, hints: MergedTopologyHints): boolean {
  const basename = filePath.split('/').at(-1) ?? filePath;
  const stem = basename.includes('.')
    ? basename.slice(0, basename.lastIndexOf('.'))
    : basename;
  if (hints.entryBasenames.includes(basename)) {
    return true;
  }
  if (hints.entryPathPatterns.some((pattern) => pattern.test(filePath))) {
    return true;
  }
  return hints.entryFileStems.some(
    (entryStem) => entryStem.toLowerCase() === stem.toLowerCase(),
  );
}

function isHighConfidenceEntry(
  basename: string,
  hints: MergedTopologyHints,
): boolean {
  const stem = basename.includes('.')
    ? basename.slice(0, basename.lastIndexOf('.'))
    : basename;
  if (hints.highConfidenceEntryBasenames.includes(basename)) {
    return true;
  }
  return hints.highConfidenceEntryStems.some(
    (entryStem) => entryStem.toLowerCase() === stem.toLowerCase(),
  );
}
