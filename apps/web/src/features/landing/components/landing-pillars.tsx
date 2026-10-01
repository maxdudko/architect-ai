import { BookOpen, MessageSquare, Network } from 'lucide-react';
import { SectionEyebrow } from './landing-ui';

const pillars = [
  {
    kicker: 'Ask',
    title: 'Repository Q&A',
    icon: MessageSquare,
    detail:
      'Ask how authentication works, where a flow lives, or which code talks to Redis. Answers are scoped to one repository or to the ready repositories in a workspace, and they cite the files they used.',
  },
  {
    kicker: 'Explore',
    title: 'Architecture',
    icon: Network,
    detail:
      'See folder-level modules and the imports between them. Ask what a module depends on, what depends on it, and read a system overview generated from that graph.',
  },
  {
    kicker: 'Learn',
    title: 'Onboarding guides',
    icon: BookOpen,
    detail:
      'Generate a structured guide set from the index: overview, folders, modules, services, technology stack, reading order, glossary, pitfalls, and an executive summary. Guides refresh after a successful reindex, or on demand.',
  },
];

const shipped = [
  {
    title: 'Repository intelligence',
    points: [
      'Repository and workspace Q&A',
      'Source citations on answers',
      'Living onboarding guides',
      'Streaming answers over SSE',
    ],
  },
  {
    title: 'Architecture intelligence',
    points: [
      'Folder-level dependency map',
      'Dependency questions',
      'System overview from that graph',
      'Evidence on each resolved import',
    ],
  },
];

export function ProductPillars() {
  return (
    <section
      id="product"
      className="scroll-mt-20 border-b border-border/70 bg-accent/30 py-20 md:py-28"
    >
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>The product</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Ask. Explore. Learn.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Architect AI is a codebase intelligence platform. Onboarding is one use of it: the same
            index also answers questions and shows how the code is structured.
          </p>
        </div>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {pillars.map(({ kicker, title, detail, icon: Icon }, index) => (
            <li
              id={kicker === 'Learn' ? 'guides' : undefined}
              key={index}
              className="scroll-mt-20 bg-card p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[.16em] text-[hsl(var(--landing-accent))]">
                  {kicker}
                </p>
                <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
              </div>
              <h3 className="mt-8 text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {shipped.map(({ title, points }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{title}</h3>
                <span className="rounded-full border border-[hsl(var(--landing-accent)/.35)] bg-[hsl(var(--landing-accent)/.08)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--landing-accent))]">
                  Shipped
                </span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {points.map((point) => (
                  <li key={point} className="text-sm text-muted-foreground">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
