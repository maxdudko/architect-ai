import {
  ARCHITECTURE_SEARCH_CLASSIFIER_MARKER,
  ARCHITECTURE_SEARCH_INTENTS,
  ARCHITECTURE_SEARCH_LIMITS,
  type ArchitectureSearchIntent,
} from './architecture-search.constants';

export class ClassifierOutputError extends Error {
  constructor() {
    super('Architecture search could not interpret the question');
  }
}

export interface ClassifiedQuestion {
  intent: ArchitectureSearchIntent;
  entities: string[];
}

/**
 * Reads the classifier's JSON object out of a model response.
 * Surrounding prose is ignored. An unknown intent or missing object fails
 * closed so the caller can ask the member to retry instead of guessing.
 */
export function parseClassifierResponse(content: string): ClassifiedQuestion {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new ClassifierOutputError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new ClassifierOutputError();
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ClassifierOutputError();
  }

  const record = parsed as { intent?: unknown; entities?: unknown };
  if (
    typeof record.intent !== 'string' ||
    !(ARCHITECTURE_SEARCH_INTENTS as readonly string[]).includes(record.intent)
  ) {
    throw new ClassifierOutputError();
  }

  const entities = Array.isArray(record.entities)
    ? record.entities
        .filter((entity): entity is string => typeof entity === 'string')
        .map((entity) => entity.trim())
        .filter((entity) => entity.length > 0)
        .slice(0, ARCHITECTURE_SEARCH_LIMITS.classifierEntities)
    : [];

  return {
    intent: record.intent as ArchitectureSearchIntent,
    entities,
  };
}

export function classifierMarker(): string {
  return ARCHITECTURE_SEARCH_CLASSIFIER_MARKER;
}
