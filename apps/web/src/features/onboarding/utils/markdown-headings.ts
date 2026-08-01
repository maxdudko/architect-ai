export interface MarkdownHeading {
  depth: number;
  text: string;
  slug: string;
}

interface MarkdownAstNode {
  type: string;
  tagName?: string;
  depth?: number;
  value?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownAstNode[];
}

export function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const counts = new Map<string, number>();
  const headings: MarkdownHeading[] = [];
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const text = match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    const base = slugifyHeading(text) || 'section';
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    headings.push({
      depth: match[1].length,
      text,
      slug: count === 0 ? base : `${base}-${count}`,
    });
  }

  return headings;
}

function nodeText(node: MarkdownAstNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return node.children?.map(nodeText).join('') ?? '';
}

export function rehypeStableHeadingSlugs() {
  return (tree: MarkdownAstNode) => {
    const counts = new Map<string, number>();

    function visit(node: MarkdownAstNode) {
      if (node.type === 'element' && /^h[2-4]$/.test(node.tagName ?? '')) {
        const base = slugifyHeading(nodeText(node)) || 'section';
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        node.properties = {
          ...node.properties,
          id: count === 0 ? base : `${base}-${count}`,
        };
      }
      node.children?.forEach(visit);
    }

    visit(tree);
  };
}
