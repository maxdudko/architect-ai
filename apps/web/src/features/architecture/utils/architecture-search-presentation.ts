import type { EpistemicLabel } from '@/entities';

export interface EpistemicPresentation {
  label: string;
  description: string;
  className: string;
}

const EPISTEMIC_PRESENTATION: Record<EpistemicLabel, EpistemicPresentation> = {
  OBSERVED: {
    label: 'Observed',
    description:
      'Supported by a resolved import dependency in this indexing revision, with source evidence.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  INTERPRETED: {
    label: 'Interpreted',
    description: 'The model is reading retrieved source. This is not proof of a dependency.',
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  NOT_ESTABLISHABLE: {
    label: 'Not establishable',
    description:
      'Indexed architecture data cannot establish this. The answer does not treat it as a fact.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
};

export function describeEpistemic(label: EpistemicLabel): EpistemicPresentation {
  return EPISTEMIC_PRESENTATION[label] ?? EPISTEMIC_PRESENTATION.NOT_ESTABLISHABLE;
}

/** Helper text under an answer. An empty observed result must not claim a dependency exists. */
export function describeAnswerEpistemic(label: EpistemicLabel, findingCount: number): string {
  if (label === 'OBSERVED' && findingCount === 0) {
    return 'No resolved import matching this question was observed in this revision.';
  }
  return describeEpistemic(label).description;
}

export function describeSearchIntent(intent: string): string {
  switch (intent) {
    case 'DEPENDENTS_OF':
      return 'What depends on this module';
    case 'DEPENDENCIES_OF':
      return 'What this module depends on';
    case 'CONNECTED_TO':
      return 'Modules connected in either direction';
    case 'MODULE_REFERENCES':
      return 'Modules that reference this file or utility';
    case 'SOURCE_EXPLANATION':
      return 'Source explanation';
    case 'NOT_ESTABLISHABLE':
      return 'Not establishable from indexed data';
    default:
      return 'Outside supported architecture questions';
  }
}
