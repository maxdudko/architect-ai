import { describe, expect, it } from 'vitest';
import {
  describeAnswerEpistemic,
  describeEpistemic,
  describeSearchIntent,
} from './architecture-search-presentation';

describe('architecture search presentation', () => {
  it('keeps observed, interpreted, and not-establishable answers distinct', () => {
    const observed = describeEpistemic('OBSERVED');
    const interpreted = describeEpistemic('INTERPRETED');
    const unavailable = describeEpistemic('NOT_ESTABLISHABLE');

    expect(observed.label).toBe('Observed');
    expect(interpreted.label).toBe('Interpreted');
    expect(unavailable.label).toBe('Not establishable');
    expect(new Set([observed.className, interpreted.className, unavailable.className]).size).toBe(
      3,
    );
    expect(interpreted.description.toLowerCase()).toContain('not proof of a dependency');
  });

  it('does not describe an empty observed answer as a resolved dependency', () => {
    expect(describeAnswerEpistemic('OBSERVED', 0).toLowerCase()).toContain('no resolved import');
    expect(describeAnswerEpistemic('OBSERVED', 2)).toContain('resolved import');
  });

  it('names the supported structural intents', () => {
    expect(describeSearchIntent('DEPENDENTS_OF')).toContain('depends on');
    expect(describeSearchIntent('UNSUPPORTED')).toContain('supported');
  });
});
