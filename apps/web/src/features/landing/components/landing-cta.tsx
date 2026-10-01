import { PrimaryCta, SectionEyebrow } from './landing-ui';

export function FinalCta({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <SectionEyebrow>Start with one repository</SectionEyebrow>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Connect one repository. Understand the system behind it.
              </h2>
              <p className="mt-5 max-w-xl text-muted-foreground">
                Start with the questions your team keeps rediscovering.
              </p>
            </div>
            <PrimaryCta isAuthenticated={isAuthenticated} idleLabel="Connect a repository" />
          </div>
        </div>
      </div>
    </section>
  );
}
