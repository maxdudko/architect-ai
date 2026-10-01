import { SectionEyebrow } from './landing-ui';

const problems = [
  {
    title: 'Slow onboarding',
    detail:
      'New engineers spend days reconstructing an unfamiliar system from code, docs, and conversations.',
  },
  {
    title: 'Knowledge lives in people',
    detail:
      'Senior engineers become the interface for questions about how the system actually works.',
  },
  {
    title: 'Architecture is implicit',
    detail:
      'Dependencies, boundaries, and relationships are in the code, and still take manual exploration to see.',
  },
];

export function ProblemSection() {
  return (
    <section className="border-b border-border/70 py-20 md:py-28">
      <div className="container grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
        <div>
          <SectionEyebrow>The problem</SectionEyebrow>
          <h2 className="max-w-lg text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            The code is there.{' '}
            <span className="text-muted-foreground">The context is missing.</span>
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {problems.map(({ title, detail }) => (
            <div key={title} className="border-l-2 border-border pl-4">
              <p className="font-mono text-xs text-[hsl(var(--landing-accent))]">{title}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
