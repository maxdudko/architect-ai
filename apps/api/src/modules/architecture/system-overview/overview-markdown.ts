import {
  SYSTEM_OVERVIEW_HEADINGS,
  SYSTEM_OVERVIEW_LIMITS,
  UNCLEAR_FROM_INDEXED_EVIDENCE,
  type SystemOverviewHeading,
} from './system-overview.constants';

const DOCUMENT_TRUNCATION_NOTE =
  'This overview was shortened to stay within the document length bound. Every required section is retained, and omitted detail is not enumerated here.';

/**
 * Enforces the required section order after generation. Unexpected H2 headings
 * become H3s. A missing section is filled rather than dropped.
 */
export function normalizeOverviewMarkdown(raw: string, title: string): string {
  const required = new Map(
    SYSTEM_OVERVIEW_HEADINGS.map((heading) => [heading.toLowerCase(), heading]),
  );
  const markdown = raw
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^#\s+.+$/m, '')
    .replace(/^##\s+(.+)$/gm, (line, heading: string) =>
      required.has(heading.trim().toLowerCase())
        ? line
        : `### ${heading.trim()}`,
    )
    .trim();

  const sections = new Map<SystemOverviewHeading, string[]>();
  let activeHeading: SystemOverviewHeading = SYSTEM_OVERVIEW_HEADINGS[0];

  for (const part of markdown.split(/^##\s+(.+)$/gm)) {
    const matched = required.get(part.trim().toLowerCase());
    if (matched) {
      activeHeading = matched;
      continue;
    }
    if (!part.trim()) {
      continue;
    }
    const content = /^##\s+/m.test(part)
      ? part.replace(/^##\s+/gm, '### ')
      : part;
    sections.set(activeHeading, [
      ...(sections.get(activeHeading) ?? []),
      content.trim(),
    ]);
  }

  return assemble(
    title,
    SYSTEM_OVERVIEW_HEADINGS.map((heading) => ({
      heading,
      body:
        sections.get(heading)?.join('\n\n').trim() ||
        UNCLEAR_FROM_INDEXED_EVIDENCE,
    })),
  );
}

export function appendLimitation(markdown: string, statement: string): string {
  const heading = 'Limitations';
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0 || markdown.includes(statement)) {
    return markdown;
  }
  const after = start + marker.length;
  const next = markdown.indexOf('\n## ', after);
  const bodyEnd = next === -1 ? markdown.length : next;
  const body = markdown.slice(after, bodyEnd).trim();
  const replacement = body
    ? `\n\n${body}\n\n${statement}\n\n`
    : `\n\n${statement}\n\n`;
  return `${markdown.slice(0, after)}${replacement}${markdown.slice(bodyEnd)}`.replace(
    /\n{3,}/g,
    '\n\n',
  );
}

/**
 * Shortens section bodies until the document fits. Headings stay in order.
 */
export function capOverviewMarkdown(markdown: string): {
  markdown: string;
  truncated: boolean;
} {
  if (markdown.length <= SYSTEM_OVERVIEW_LIMITS.maxMarkdownChars) {
    return { markdown, truncated: false };
  }

  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'System overview';
  const sections = SYSTEM_OVERVIEW_HEADINGS.map((heading) => ({
    heading,
    body: sectionBody(markdown, heading),
  }));
  const noteReserve = DOCUMENT_TRUNCATION_NOTE.length + 4;
  const skeleton = assemble(
    title,
    sections.map((section) => ({ ...section, body: '' })),
  );
  const budget =
    SYSTEM_OVERVIEW_LIMITS.maxMarkdownChars - skeleton.length - noteReserve;

  while (
    sections.reduce((total, section) => total + section.body.length, 0) > budget
  ) {
    const longest = sections.reduce(
      (best, section, index) =>
        section.body.length > sections[best].body.length ? index : best,
      0,
    );
    if (sections[longest].body.length <= UNCLEAR_FROM_INDEXED_EVIDENCE.length) {
      break;
    }
    const nextLength = Math.max(
      UNCLEAR_FROM_INDEXED_EVIDENCE.length,
      sections[longest].body.length - 500,
    );
    sections[longest].body = sections[longest].body.slice(0, nextLength).trim();
    if (!sections[longest].body) {
      sections[longest].body = UNCLEAR_FROM_INDEXED_EVIDENCE;
    }
  }

  const limitations = sections.find(
    (section) => section.heading === 'Limitations',
  );
  if (limitations && !limitations.body.includes(DOCUMENT_TRUNCATION_NOTE)) {
    limitations.body =
      `${limitations.body}\n\n${DOCUMENT_TRUNCATION_NOTE}`.trim();
  }

  return { markdown: assemble(title, sections), truncated: true };
}

export function deriveOverviewSummary(
  markdown: string,
  maxLength = 280,
): string {
  const prose = markdown
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (prose.length <= maxLength) {
    return prose;
  }
  const clipped = prose.slice(0, maxLength - 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > maxLength / 2 ? boundary : undefined)}…`;
}

function sectionBody(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) {
    return UNCLEAR_FROM_INDEXED_EVIDENCE;
  }
  const after = start + marker.length;
  const next = markdown.indexOf('\n## ', after);
  const body = markdown.slice(after, next === -1 ? undefined : next).trim();
  return body || UNCLEAR_FROM_INDEXED_EVIDENCE;
}

function assemble(
  title: string,
  sections: Array<{ heading: string; body: string }>,
): string {
  const output = [`# ${title}`];
  for (const section of sections) {
    output.push(
      `## ${section.heading}`,
      section.body || UNCLEAR_FROM_INDEXED_EVIDENCE,
    );
  }
  return `${output.join('\n\n').trim()}\n`;
}
