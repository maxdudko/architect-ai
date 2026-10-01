import { TerminalSquare } from 'lucide-react';
import { SectionEyebrow, SourceReference } from './landing-ui';

const signals = ['Repository-scoped', 'Workspace-wide', 'Source references', 'Answer feedback'];

export function GroundedAnswers() {
  return (
    <section className="border-b border-border/70 bg-accent/30 py-20 md:py-28">
      <div className="container grid gap-12 lg:grid-cols-[1fr_.9fr] lg:items-center">
        <div>
          <SectionEyebrow>Explainable by design</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Every answer has a trail back to the code.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            The model writes the explanation. Engineers can inspect the files it used. That is the
            point: generated answers stay reviewable, scoped to the repository or workspace you are
            actually working in.
          </p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {signals.map((item) => (
              <li
                key={item}
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-4 text-xs">
            <span className="flex items-center gap-2 font-medium">
              <TerminalSquare
                className="size-4 text-[hsl(var(--landing-accent))]"
                aria-hidden="true"
              />
              Source-grounded answer
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">REPOSITORY</span>
          </div>
          <div className="mt-5 rounded-md bg-accent p-3 font-mono text-xs">
            Which parts of indexing use Redis?
          </div>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            Indexing jobs run on a Redis-backed queue. Retrieval can cache assembled context in
            Redis, and falls back to memory when that cache is not configured. The answer cites
            those files rather than treating the model as the authority.
          </p>
          <div className="mt-5 space-y-2">
            <SourceReference source="apps/api/src/repositories/repository-indexing.queue.service.ts" />
            <SourceReference source="apps/api/src/modules/retrieval/cache/redis-retrieval.cache.ts" />
          </div>
        </div>
      </div>
    </section>
  );
}
