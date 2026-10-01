import { Bot, CircleDot, RefreshCw } from 'lucide-react';

const providers = [
  { name: 'Hosted AI', detail: 'No key required' },
  { name: 'OpenAI', detail: 'Your key' },
  { name: 'Anthropic', detail: 'Your key' },
  { name: 'Gemini', detail: 'Your key' },
  { name: 'Grok', detail: 'xAI, your key' },
];

export function ModelAgnostic() {
  return (
    <section className="border-b border-border/70 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--landing-accent))]">
            <CircleDot className="size-3" aria-hidden="true" />
            Model-agnostic by design
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Your codebase shouldn&apos;t belong to an AI provider.
          </h2>
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            We don&apos;t care who wins the AI wars.
          </p>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Chat, onboarding guides, architecture answers, and the system overview use the model the
            workspace selects. Hosted AI needs no key. Bring your own OpenAI, Anthropic, Gemini, or
            Grok key, keep more than one saved, and switch the active provider without a redeploy.
            Embeddings stay on the platform embedding provider either way.
          </p>
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {providers.map(({ name, detail }) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                {name === 'Hosted AI' ? (
                  <RefreshCw
                    className="size-4 text-[hsl(var(--landing-accent))]"
                    aria-hidden="true"
                  />
                ) : (
                  <Bot className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                )}
              </span>
              <div className="text-left">
                <p className="text-sm font-medium leading-tight">{name}</p>
                <p className="text-xs leading-tight text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Switching the active provider does not change the plan price. Questions and guide
          generations follow plan limits on Hosted AI, and are uncapped while BYOK is active.
        </p>
      </div>
    </section>
  );
}
