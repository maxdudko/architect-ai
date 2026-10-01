import { SectionEyebrow } from './landing-ui';

const stages = [
  {
    when: 'Now',
    title: 'Codebase intelligence',
    detail: 'Chat, onboarding guides, and architecture exploration over an indexed repository.',
    status: 'Shipped',
    shipped: true,
  },
  {
    when: 'Next',
    title: 'Engineering memory',
    detail: 'Decisions, documents, and tickets alongside the code.',
    status: 'Planned',
    shipped: false,
  },
  {
    when: 'Later',
    title: 'Engineering intelligence',
    detail: 'Impact analysis, design reviews, and architecture guidance.',
    status: 'Planned',
    shipped: false,
  },
];

export function VisionSection() {
  return (
    <section id="vision" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>Where this goes</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Codebase intelligence first.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            The product you can use today answers from the repository. Remembering why decisions
            were made, and advising on change, comes after that.
          </p>
        </div>
        <ol className="mt-12 grid gap-6 lg:grid-cols-3">
          {stages.map(({ when, title, detail, status, shipped }) => (
            <li
              key={when}
              className={`rounded-xl border p-6 ${shipped ? 'border-[hsl(var(--landing-accent)/.45)] bg-card' : 'border-border bg-card'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <p
                  className={`font-mono text-xs uppercase tracking-[.14em] ${shipped ? 'text-[hsl(var(--landing-accent))]' : 'text-muted-foreground'}`}
                >
                  {when}
                </p>
                <span
                  className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${shipped ? 'border-[hsl(var(--landing-accent)/.35)] bg-[hsl(var(--landing-accent)/.08)] text-[hsl(var(--landing-accent))]' : 'border-border text-muted-foreground'}`}
                >
                  {status}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Enterprise hosting and governance are a separate track. SSO, audit logs, and air-gapped
          deployment are not part of the product today.
        </p>
      </div>
    </section>
  );
}
