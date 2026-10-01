import {
  capOverviewMarkdown,
  normalizeOverviewMarkdown,
} from './overview-markdown';
import {
  SYSTEM_OVERVIEW_HEADINGS,
  SYSTEM_OVERVIEW_LIMITS,
  UNCLEAR_FROM_INDEXED_EVIDENCE,
} from './system-overview.constants';

describe('overview markdown', () => {
  it('fills missing sections and demotes unexpected headings', () => {
    const markdown = normalizeOverviewMarkdown(
      [
        '```markdown',
        '# Ignored title',
        '## Main Modules',
        'Billing is a module.',
        '## Extra notes',
        'This is not a required heading.',
        '```',
      ].join('\n'),
      'acme/app system overview',
    );

    expect(markdown.startsWith('# acme/app system overview')).toBe(true);
    for (const heading of SYSTEM_OVERVIEW_HEADINGS) {
      expect(markdown).toContain(`## ${heading}`);
    }
    expect(markdown).toContain('### Extra notes');
    expect(markdown).not.toMatch(/^## Extra notes$/m);
    expect(markdown).toContain(UNCLEAR_FROM_INDEXED_EVIDENCE);
    expect(markdown).not.toContain('```');
  });

  it('shortens bodies without dropping a required heading', () => {
    const body = 'Observed path `src/billing/invoice.ts`. '.repeat(800);
    const raw = [
      '# Title',
      ...SYSTEM_OVERVIEW_HEADINGS.flatMap((heading) => [`## ${heading}`, body]),
    ].join('\n\n');
    const capped = capOverviewMarkdown(raw);

    expect(capped.truncated).toBe(true);
    expect(capped.markdown.length).toBeLessThanOrEqual(
      SYSTEM_OVERVIEW_LIMITS.maxMarkdownChars + 200,
    );
    for (const heading of SYSTEM_OVERVIEW_HEADINGS) {
      expect(capped.markdown).toContain(`## ${heading}`);
    }
    expect(capped.markdown).toContain(
      'shortened to stay within the document length bound',
    );
  });
});
