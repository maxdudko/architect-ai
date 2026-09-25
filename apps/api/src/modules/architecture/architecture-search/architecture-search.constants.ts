import { DEPENDENCY_MAP_LIMITS } from '../dependency-mapping/dependency-map.constants';

/**
 * Fixed budgets for Architecture Search (spec LG-5, Q-8).
 * None of these are request parameters.
 */
export const ARCHITECTURE_SEARCH_LIMITS = {
  questionMaxLength: 2_000,
  classifierModuleInventory: DEPENDENCY_MAP_LIMITS.modulesPerView,
  ambiguousCandidates: 10,
  nearCandidates: 5,
  classifierEntities: 5,
  dependenciesPerFinding: DEPENDENCY_MAP_LIMITS.dependenciesPerModule,
  dependentsPerFinding: DEPENDENCY_MAP_LIMITS.dependentsPerModule,
  evidencePerFinding: DEPENDENCY_MAP_LIMITS.evidencePerDependency,
  retrievalTopK: 8,
  retrievedSourceChars: 8_000,
  structuredFactsChars: 12_000,
} as const;

export const ARCHITECTURE_SEARCH_INTENTS = [
  'DEPENDENTS_OF',
  'DEPENDENCIES_OF',
  'CONNECTED_TO',
  'MODULE_REFERENCES',
  'SOURCE_EXPLANATION',
  'NOT_ESTABLISHABLE',
  'UNSUPPORTED',
] as const;

export type ArchitectureSearchIntent =
  (typeof ARCHITECTURE_SEARCH_INTENTS)[number];

export const STRUCTURAL_INTENTS = [
  'DEPENDENTS_OF',
  'DEPENDENCIES_OF',
  'CONNECTED_TO',
  'MODULE_REFERENCES',
] as const satisfies readonly ArchitectureSearchIntent[];

export type StructuralIntent = (typeof STRUCTURAL_INTENTS)[number];

export const EPISTEMIC_LABELS = [
  'OBSERVED',
  'INTERPRETED',
  'NOT_ESTABLISHABLE',
] as const;

export type EpistemicLabel = (typeof EPISTEMIC_LABELS)[number];

export const ARCHITECTURE_SEARCH_METADATA_KIND = 'architecture-search' as const;

/** Marker so a caller can tell a classifier prompt from an answer prompt. */
export const ARCHITECTURE_SEARCH_CLASSIFIER_MARKER =
  'architecture-search-classify';

export const ARCHITECTURE_SEARCH_SUPPORTED_QUESTIONS = [
  'What depends on a named module?',
  'What does a named module depend on?',
  'Which modules are connected to a named module, in either direction?',
  'Which modules reference a named file or utility?',
  'How does a part of the repository work, answered from indexed source and marked as interpretation?',
] as const;

export const ARCHITECTURE_SEARCH_LIMITATIONS = [
  'The answer reflects statically observed import relationships in supported languages for one indexing revision.',
  'Absence of a relationship is not proof that no runtime dependency exists.',
  'Semantic similarity and retrieval rank are not evidence of a dependency.',
  'Only import relationships can produce a module dependency. Inheritance, calls, and usages are not drawn.',
  'Derived modules are folder groupings. They do not necessarily correspond to deployment units, packages, or services.',
] as const;

export function isStructuralIntent(
  intent: ArchitectureSearchIntent,
): intent is StructuralIntent {
  return (STRUCTURAL_INTENTS as readonly string[]).includes(intent);
}
