/**
 * Declared thresholds for Dependency Mapping (spec LG-4).
 *
 * These are fixed and documented. They are not overridable by request
 * parameters, so no caller can ask for an unbounded result (FR-9).
 */
export const DEPENDENCY_MAP_LIMITS = {
  /** Modules returned in the repository-level view. */
  modulesPerView: 40,
  /** Module-to-module edges returned in the repository-level view. */
  edgesPerView: 80,
  /** Direct dependencies returned for a selected module. */
  dependenciesPerModule: 25,
  /** Direct dependents returned for a selected module. */
  dependentsPerModule: 25,
  /** Evidence items retained and returned per module dependency. */
  evidencePerDependency: 20,
  /** Distinct unresolved target names reported per module. */
  unresolvedTargetsPerModule: 20,
  /** Distinct external target names reported per module. */
  externalTargetsPerModule: 20,
  /** Files listed in a module detail response. */
  filesPerModule: 50,
  /** Notable symbols listed in a module detail response. */
  symbolsPerModule: 50,
} as const;

/**
 * Derivation ceiling (spec AD-6, LG-5). Above these sizes the graph is
 * derived from a truncated input and the view is reported as partial.
 */
export const DEPENDENCY_MAP_CEILING = {
  /** Indexed files loaded for one revision. */
  maxFiles: 20_000,
  /** Distinct import relationship rows loaded for one revision. */
  maxImportRelations: 50_000,
} as const;

/** Minimum indexed files a folder needs before it becomes a module (FR-2). */
export const MODULE_MIN_FILE_COUNT = 2;

/** Maximum path segments a module key may span (FR-2). */
export const MODULE_MAX_PATH_SEGMENTS = 2;

/**
 * Folders excluded from module grouping. Carried over from the onboarding
 * topology analyzer so both surfaces group the same way.
 */
export const MODULE_EXCLUSION_PATTERN =
  /(test|spec|fixture|vendor|generated|dist|build|node_modules)/i;

/** Cache key namespace. Bumped when the derivation output shape changes. */
export const DEPENDENCY_MAP_CACHE_VERSION = 'v1';

/** Cache lifetime for a derived graph, in seconds. */
export const DEPENDENCY_MAP_CACHE_TTL_SECONDS = 600;

/**
 * Human-readable statement of the grouping rules, returned with every view so
 * the surface can explain how modules were formed and why files were dropped
 * (spec FR-2, AC-5).
 */
export const MODULE_GROUPING_RULES: readonly string[] = [
  `Files are grouped by their leading folder path of at most ${MODULE_MAX_PATH_SEGMENTS} segments.`,
  `A folder becomes a module only when it contains at least ${MODULE_MIN_FILE_COUNT} indexed files.`,
  'Folders whose path matches test, spec, fixture, vendor, generated, dist, build or node_modules are excluded.',
  'Files marked ignored, binary or generated during indexing are excluded.',
  'Grouping uses only the indexed result of a single indexing revision, so it is deterministic for that revision.',
];

/**
 * Stated limitations shown wherever relationships are displayed (spec RS-7).
 */
export const DEPENDENCY_MAP_LIMITATIONS: readonly string[] = [
  'The view reflects statically observed relationships in supported languages (TypeScript, JavaScript, Python, PHP) for one indexing revision.',
  'Absence of a relationship is not proof that no runtime dependency exists.',
  'Only import relationships carry a target path, so only imports can produce a module dependency.',
  'Import evidence identifies the source and target files, not the individual import line, because the indexing result records imports against the file module symbol.',
  'Path aliases are resolved by unique path suffix match because the repository checkout is not retained after indexing.',
  'Derived modules are folder groupings. They do not necessarily correspond to deployment units, packages or services.',
];
