import { describe, expect, it } from 'vitest';
import {
  extractMarkdownHeadings,
  rehypeStableHeadingSlugs,
  slugifyHeading,
} from './markdown-headings';

describe('slugifyHeading', () => {
  it('normalizes formatting, punctuation, whitespace, and repeated hyphens', () => {
    expect(slugifyHeading('  **API**: Setup & Usage -- Today!  ')).toBe('api-setup-usage-today');
  });

  it('keeps unicode letters and numbers', () => {
    expect(slugifyHeading('Déploiement 版本 2')).toBe('déploiement-版本-2');
  });
});

describe('extractMarkdownHeadings', () => {
  it('extracts levels two through four and ignores other heading levels', () => {
    expect(
      extractMarkdownHeadings(
        [
          '# Document title',
          '## Overview',
          '### Details',
          '#### Deep detail',
          '##### Too deep',
        ].join('\n'),
      ),
    ).toEqual([
      { depth: 2, text: 'Overview', slug: 'overview' },
      { depth: 3, text: 'Details', slug: 'details' },
      { depth: 4, text: 'Deep detail', slug: 'deep-detail' },
    ]);
  });

  it('creates stable duplicate slugs and falls back for empty slugs', () => {
    expect(
      extractMarkdownHeadings(
        ['## Setup', '### Setup', '## [Setup](https://example.com)', '## !!!', '## ???'].join('\n'),
      ),
    ).toEqual([
      { depth: 2, text: 'Setup', slug: 'setup' },
      { depth: 3, text: 'Setup', slug: 'setup-1' },
      { depth: 2, text: 'Setup', slug: 'setup-2' },
      { depth: 2, text: '!!!', slug: 'section' },
      { depth: 2, text: '???', slug: 'section-1' },
    ]);
  });

  it('ignores heading-like content inside backtick and tilde fences', () => {
    const markdown = [
      '```md',
      '## Hidden',
      '```',
      '## Visible',
      '~~~',
      '### Also hidden',
      '~~~',
    ].join('\n');

    expect(extractMarkdownHeadings(markdown)).toEqual([
      { depth: 2, text: 'Visible', slug: 'visible' },
    ]);
  });
});

describe('rehypeStableHeadingSlugs', () => {
  it('assigns extraction-compatible ids to nested headings and preserves properties', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: { className: ['heading'] },
          children: [
            { type: 'text', value: 'API ' },
            { type: 'inlineCode', value: 'setup' },
          ],
        },
        {
          type: 'element',
          tagName: 'section',
          children: [
            {
              type: 'element',
              tagName: 'h3',
              properties: {},
              children: [{ type: 'text', value: 'API setup' }],
            },
          ],
        },
        {
          type: 'element',
          tagName: 'h1',
          properties: {},
          children: [{ type: 'text', value: 'Ignored' }],
        },
      ],
    };

    rehypeStableHeadingSlugs()(tree);

    expect(tree.children[0].properties).toEqual({
      className: ['heading'],
      id: 'api-setup',
    });
    expect(tree.children[1]).toMatchObject({
      children: [{ properties: { id: 'api-setup-1' } }],
    });
    expect(tree.children[2].properties).toEqual({});
  });
});
