import { Compass, UserRound, Users } from 'lucide-react';
import { SectionEyebrow } from './landing-ui';

const audiences = [
  {
    title: 'New engineers',
    detail:
      'Understand an unfamiliar system without spending the first days asking where everything lives.',
    icon: Compass,
  },
  {
    title: 'Senior engineers',
    detail: 'Spend less time repeating how modules, flows, and dependencies actually work.',
    icon: UserRound,
  },
  {
    title: 'Engineering leads',
    detail:
      'Give the team a shared, repository-grounded place to look before interrupting someone.',
    icon: Users,
  },
];

export function AudienceSection() {
  return (
    <section className="border-b border-border/70 bg-accent/30 py-20 md:py-28">
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>Who it&apos;s for</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            For the people who have to understand the system.
          </h2>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {audiences.map(({ title, detail, icon: Icon }) => (
            <li key={title} className="rounded-xl border border-border bg-card p-6">
              <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          Designed first for engineering teams of roughly 5–30 developers.
        </p>
      </div>
    </section>
  );
}
