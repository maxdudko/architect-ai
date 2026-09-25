import {
  ARCHITECTURE_SEARCH_LIMITATIONS,
  ARCHITECTURE_SEARCH_SUPPORTED_QUESTIONS,
  type ArchitectureSearchIntent,
  type EpistemicLabel,
} from './architecture-search.constants';
import type { ModuleNameResolution } from './module-name-resolver';

export function baseLimitations(extra: string[] = []): string[] {
  return [...ARCHITECTURE_SEARCH_LIMITATIONS, ...extra];
}

export function supportedQuestionText(): string {
  return ARCHITECTURE_SEARCH_SUPPORTED_QUESTIONS.map(
    (question) => `- ${question}`,
  ).join('\n');
}

/**
 * Replies that must not be written by the model, because a generated answer
 * could pick one module or invent a relationship.
 */
export function deterministicReply(input: {
  intent: ArchitectureSearchIntent;
  resolution: ModuleNameResolution | null;
  entity: string | null;
  noModules: boolean;
}): { content: string; epistemic: EpistemicLabel } | null {
  if (input.intent === 'UNSUPPORTED') {
    return {
      epistemic: 'NOT_ESTABLISHABLE',
      content: [
        'This question is outside the architecture questions that can be answered from the indexed dependency map.',
        'Supported questions:',
        supportedQuestionText(),
      ].join('\n'),
    };
  }

  if (
    input.intent === 'SOURCE_EXPLANATION' ||
    input.intent === 'NOT_ESTABLISHABLE'
  ) {
    return null;
  }

  if (input.noModules) {
    return {
      epistemic: 'NOT_ESTABLISHABLE',
      content:
        'No modules could be identified for this indexing revision, so this structural question cannot be answered from the dependency map. Grouping uses folder prefixes and drops excluded, generated, and single-file folders.',
    };
  }

  if (!input.entity) {
    return {
      epistemic: 'NOT_ESTABLISHABLE',
      content: [
        'Name the module, file, or symbol the question is about.',
        'Supported questions:',
        supportedQuestionText(),
      ].join('\n'),
    };
  }

  if (input.resolution?.outcome === 'AMBIGUOUS') {
    const names = input.resolution.candidates
      .map((candidate) => `${candidate.name} (${candidate.path})`)
      .join(', ');
    return {
      epistemic: 'NOT_ESTABLISHABLE',
      content: `Several modules match "${input.entity}": ${names}. Choose one instead of treating them as the same module.`,
    };
  }

  if (input.resolution?.outcome === 'NOT_FOUND') {
    const near = input.resolution.nearCandidates
      .map((candidate) => `${candidate.name} (${candidate.path})`)
      .join(', ');
    const suggestion = near ? ` Nearby names in this revision: ${near}.` : '';
    return {
      epistemic: 'NOT_ESTABLISHABLE',
      content: `No module named "${input.entity}" was found in this indexing revision.${suggestion} The question was not answered about a different module.`,
    };
  }

  return null;
}

export function noRelationshipLimitation(
  intent: ArchitectureSearchIntent,
): string {
  if (intent === 'DEPENDENCIES_OF') {
    return 'No import dependency from this module to another module was observed in this revision.';
  }
  if (intent === 'DEPENDENTS_OF' || intent === 'MODULE_REFERENCES') {
    return 'No other module was observed importing this module in this revision.';
  }
  return 'No import dependency in either direction was observed for this module in this revision.';
}
