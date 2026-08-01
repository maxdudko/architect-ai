import { createHash } from 'node:crypto';
import type { GuideTemplateContract } from '../templates/guide-template.contract';

const SLUG_MAX_LENGTH = 96;
const SLUG_HASH_LENGTH = 8;

export function stableSlug(value: string): string {
  const normalized =
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'guide';

  if (normalized.length <= SLUG_MAX_LENGTH) {
    return normalized;
  }

  const hash = createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, SLUG_HASH_LENGTH);
  const prefixLength = SLUG_MAX_LENGTH - 1 - SLUG_HASH_LENGTH;
  return `${normalized.slice(0, prefixLength)}-${hash}`;
}

export function normalizeGuideMarkdown(
  raw: string,
  title: string,
  contract: GuideTemplateContract,
): string {
  const required = new Map(
    contract.headings.map((heading) => [heading.toLowerCase(), heading]),
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
  const sections = new Map<string, string[]>();
  let activeHeading = contract.headings[0];

  for (const part of markdown.split(/^##\s+(.+)$/gm)) {
    const normalized = part.trim().toLowerCase();
    const matchedHeading = required.get(normalized);
    if (matchedHeading) {
      activeHeading = matchedHeading;
      continue;
    }
    if (!part.trim()) continue;
    const content = /^##\s+/m.test(part)
      ? part.replace(/^##\s+/gm, '### ')
      : part;
    sections.set(activeHeading, [
      ...(sections.get(activeHeading) ?? []),
      content.trim(),
    ]);
  }

  const output = [`# ${title}`];
  for (const heading of contract.headings) {
    const content = sections.get(heading)?.join('\n\n').trim();
    output.push(`## ${heading}`, content || 'Unclear from indexed evidence.');
  }
  return `${output.join('\n\n').trim()}\n`;
}

export function deriveGuideSummary(markdown: string, maxLength = 280): string {
  const prose = markdown
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (prose.length <= maxLength) return prose;
  const clipped = prose.slice(0, maxLength - 1);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > maxLength / 2 ? boundary : undefined)}…`;
}
