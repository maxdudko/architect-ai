import { Code2, Github, MessageSquare, Search } from 'lucide-react';
import { SectionEyebrow } from './landing-ui';

const steps = [
  {
    label: 'Connect',
    detail: 'Connect a GitHub repository and choose a branch.',
    icon: Github,
  },
  {
    label: 'Index',
    detail: 'Parse code, symbols, imports, and structure.',
    icon: Code2,
  },
  {
    label: 'Understand',
    detail: 'Build searchable code and architecture context.',
    icon: Search,
  },
  {
    label: 'Ask',
    detail: 'Get grounded answers with references to the source. Tokens stream over SSE.',
    icon: MessageSquare,
  },
];

const statuses = ['cloning', 'parsing', 'chunking', 'embedding', 'ready'];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>From repository to understanding</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Connect a repository. Ask it questions.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Indexing turns the repository into context your team can search. The model explains that
            context. It does not become the source of truth.
          </p>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {steps.map(({ label, detail, icon: Icon }, index) => (
            <li key={label} className="bg-card p-6">
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="mt-12 font-medium">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
          {statuses.map((status, index) => (
            <span key={status} className="flex items-center gap-2">
              <span
                className={`size-1.5 rounded-full ${index === statuses.length - 1 ? 'bg-[hsl(var(--landing-accent))]' : 'bg-muted-foreground/50'}`}
              />
              {status}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
