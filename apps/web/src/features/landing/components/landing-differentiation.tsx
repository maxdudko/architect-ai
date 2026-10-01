import { SectionEyebrow } from './landing-ui';

const pairs = [
  {
    label: 'Coding assistant',
    line: 'Help me write this code.',
    emphasis: false,
  },
  {
    label: 'Architect AI',
    line: 'Help me understand this system.',
    emphasis: true,
  },
  {
    label: 'Documentation',
    line: 'Tell me what someone documented.',
    emphasis: false,
  },
  {
    label: 'Architect AI',
    line: 'Explain what exists in the repository now.',
    emphasis: true,
  },
];

export function DifferentiationSection() {
  return (
    <section className="border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>Not another coding assistant</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Coding assistants write code. Architect AI explains the system.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Use a coding assistant to change the code. Use Architect AI to understand the system
            around it. The two jobs are different.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {pairs.map(({ label, line, emphasis }) => (
            <li
              key={line}
              className={`rounded-xl border p-6 ${emphasis ? 'border-[hsl(var(--landing-accent)/.45)] bg-[hsl(var(--landing-accent)/.06)]' : 'border-border bg-card'}`}
            >
              <p className="font-mono text-xs uppercase tracking-[.14em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-4 text-lg font-medium">{line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
