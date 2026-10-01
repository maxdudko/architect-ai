/**
 * Fixed budgets for System Overview. None of these are request parameters.
 */
export const SYSTEM_OVERVIEW_LIMITS = {
  modules: 20,
  dependencies: 40,
  unresolvedSummaries: 20,
  externalSummaries: 20,
  technologyEvidence: 20,
  entryPoints: 20,
  evidencePathsPerDependency: 3,
  retrievalTopK: 8,
  retrievedSourceChars: 8_000,
  structuredFactsChars: 12_000,
  maxMarkdownChars: 16_000,
  totalSteps: 4,
} as const;

export const SYSTEM_OVERVIEW_HEADINGS = [
  'Main Modules',
  'Module Dependencies',
  'Technologies and Infrastructure',
  'Integration Patterns',
  'Architectural Boundaries',
  'Limitations',
] as const;

export type SystemOverviewHeading = (typeof SYSTEM_OVERVIEW_HEADINGS)[number];

export const UNCLEAR_FROM_INDEXED_EVIDENCE = 'Unclear from indexed evidence.';

export const REDUCED_BASIS_STATEMENT =
  'No modules could be identified for this indexing revision, so this overview is not grounded in module dependencies. Folder statistics are not used as a substitute.';

export const SYSTEM_OVERVIEW_LIMITATIONS = [
  'The overview reflects statically observed import relationships in supported languages for one indexing revision.',
  'Absence of a relationship is not proof that no runtime dependency exists.',
  'Semantic similarity and retrieval rank are not evidence of a dependency.',
  'Only import relationships can produce a module dependency. Inheritance, calls, and usages are not drawn.',
  'Derived modules are folder groupings. They do not necessarily correspond to deployment units, packages, or services.',
  'Technology statements come from manifest and configuration file names, or from cited source marked as inference. No inventory of brokers, queues, or deployment topology is available.',
] as const;

export const SYSTEM_OVERVIEW_QUEUE = 'architecture-overview-generation';
export const SYSTEM_OVERVIEW_JOB_NAME = 'generate-architecture-overview';

export const OVERVIEW_GENERATION_FAILED_MESSAGE =
  'Architecture overview generation failed. Try again.';
