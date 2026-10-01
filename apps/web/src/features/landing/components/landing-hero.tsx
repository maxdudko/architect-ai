'use client';

import { ArrowDown, Check, GitBranch, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { PrimaryCta, SectionEyebrow, SourceReference, type SectionLinkHandler } from './landing-ui';

const questions = [
  {
    label: 'Authentication',
    question: 'How does authentication work?',
    answer:
      'Requests pass through the JWT auth guard. Workspace and role guards then decide what that caller can do.',
    sources: [
      'apps/api/src/common/guards/jwt-auth.guard.ts',
      'apps/api/src/common/guards/roles.guard.ts',
    ],
  },
  {
    label: 'Onboarding guides',
    question: 'How are onboarding guides generated?',
    answer:
      'After indexing, the orchestrator discovers guide targets from repository topology, retrieves focused evidence, and asks the configured model for evidence-constrained Markdown.',
    sources: [
      'apps/api/src/modules/onboarding/onboarding-guide.orchestrator.ts',
      'apps/api/src/modules/onboarding/generators/guide-generator.registry.ts',
    ],
  },
  {
    label: 'Dependencies',
    question: 'What depends on the authentication module?',
    answer:
      'Authentication code lives under apps/api/src/auth, inside the apps/api folder module. Dependency questions are answered from resolved imports between folder modules in the current index.',
    sources: [
      'apps/api/src/auth/auth.module.ts',
      'apps/api/src/modules/architecture/architecture-search/structural-query.ts',
    ],
  },
];

const repositoryPaths = [
  'apps/api/src/auth',
  'apps/api/src/workspaces',
  'apps/api/src/repositories',
  'apps/api/src/modules/retrieval',
  'apps/api/src/chat',
];

const signals = ['GitHub', 'TypeScript', 'JavaScript', 'Python', 'PHP', 'BYOK', 'Self-hostable'];

export function LandingHero({
  isAuthenticated,
  onNavigate,
}: {
  isAuthenticated: boolean;
  onNavigate: SectionLinkHandler;
}) {
  const [activeQuestion, setActiveQuestion] = useState(questions[0]);

  return (
    <section className="relative border-b border-border/70">
      <div className="container grid gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,.86fr)_minmax(440px,1.14fr)] lg:items-center lg:gap-16 lg:py-28">
        <div>
          <SectionEyebrow>AI codebase intelligence</SectionEyebrow>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
            Understand any codebase.{' '}
            <span className="text-muted-foreground">Without reconstructing it from scratch.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Architect AI turns your repositories into searchable engineering context. Ask questions,
            explore architecture, and generate onboarding guides — with answers grounded in your
            actual code.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCta isAuthenticated={isAuthenticated} idleLabel="Start with one repository" />
            <a
              href="#how-it-works"
              onClick={(event) => onNavigate(event, 'how-it-works')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore how it works
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-5 font-mono text-xs text-muted-foreground">{signals.join(' · ')}</p>
        </div>

        <div className="relative rounded-xl border border-border bg-card p-3 md:p-5">
          <div className="flex items-center justify-between border-b border-border px-2 pb-4">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-[hsl(var(--landing-accent))]" />
              architect-ai / api
            </div>
            <span className="rounded-full border border-[hsl(var(--landing-accent)/.35)] bg-[hsl(var(--landing-accent)/.08)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--landing-accent))]">
              INDEXED
            </span>
          </div>
          <div className="grid gap-5 p-2 pt-5 md:grid-cols-[.72fr_1.28fr]">
            <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
              <p className="mb-3 text-foreground">Repository</p>
              {repositoryPaths.map((item, index) => (
                <div
                  key={item}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 ${index === 0 ? 'bg-accent text-foreground' : ''}`}
                >
                  <GitBranch
                    className="size-3 shrink-0 text-[hsl(var(--landing-accent))]"
                    aria-hidden="true"
                  />
                  <span className="truncate">{item}</span>
                </div>
              ))}
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-[10px]">
                <Check className="size-3 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                Indexed repository context
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden="true" />
                Ask your codebase
              </div>
              <p className="mb-4 font-mono text-[10px] text-muted-foreground">
                Grounded in indexed repository context
              </p>
              <div className="mb-4 rounded-md bg-accent px-3 py-2 font-mono text-xs text-foreground">
                {activeQuestion.question}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{activeQuestion.answer}</p>
              <div className="mt-5 space-y-2">
                {activeQuestion.sources.map((source) => (
                  <SourceReference key={source} source={source} />
                ))}
              </div>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-2 border-t border-border px-2 pt-4"
            role="group"
            aria-label="Example questions"
          >
            {questions.map((question) => {
              const selected = activeQuestion.label === question.label;
              return (
                <button
                  key={question.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveQuestion(question)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-[hsl(var(--landing-accent)/.55)] bg-[hsl(var(--landing-accent)/.08)] text-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}
                >
                  {question.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
