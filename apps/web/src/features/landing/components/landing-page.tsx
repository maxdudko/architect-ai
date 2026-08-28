'use client';

import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bot,
  Building2,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Globe,
  KeyRound,
  Linkedin,
  Lock,
  MessageSquare,
  Minus,
  Network,
  RefreshCw,
  Rocket,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useState, type FormEvent, type SyntheticEvent } from 'react';
import { submitContactMessage } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { BrandMark, Button, Input, Loader, Textarea } from '@/shared/components';
import { LandingPlansSection } from './landing-plans';

const questions = [
  {
    label: 'Authentication',
    question: 'How does authentication work?',
    answer:
      'Requests pass through the JWT auth guard, which verifies the access token before workspace and role guards resolve what the caller can actually do.',
    sources: [
      'apps/api/src/common/guards/jwt-auth.guard.ts',
      'apps/api/src/workspaces/workspaces.service.ts',
    ],
  },
  {
    label: 'Onboarding guides',
    question: 'How are onboarding guides generated?',
    answer:
      'After indexing, the orchestrator discovers guide targets from the repository topology, retrieves focused evidence for each, and asks the configured LLM for evidence-constrained Markdown.',
    sources: [
      'apps/api/src/modules/onboarding/onboarding-guide.orchestrator.ts',
      'apps/api/src/modules/onboarding/generators/guide-generator.registry.ts',
    ],
  },
  {
    label: 'New endpoint',
    question: 'Where should I add a new API endpoint?',
    answer:
      'Add the route to the module that owns the domain behavior, then keep validation in its schema and persistence behind the service boundary.',
    sources: [
      'apps/api/src/repositories/repositories.controller.ts',
      'apps/api/src/repositories/repositories.service.ts',
    ],
  },
];

const pipeline = [
  { label: 'Connect', detail: 'Choose a GitHub repository.', icon: Github },
  { label: 'Understand', detail: 'Parse files, symbols, and relations.', icon: Code2 },
  { label: 'Ground', detail: 'Build searchable repository context.', icon: Search },
  { label: 'Answer', detail: 'Stream cited answers, token by token.', icon: MessageSquare },
];

const capabilities = [
  {
    label: 'Streaming answers',
    detail: 'Tokens stream live over SSE as the model responds.',
    icon: Zap,
  },
  {
    label: 'Bring your own model',
    detail: 'OpenAI, Anthropic, Grok, or Gemini—your key, your choice.',
    icon: KeyRound,
  },
  {
    label: 'Workspaces & roles',
    detail: 'Owner, admin, member, and viewer access per workspace.',
    icon: Users,
  },
  {
    label: 'Encrypted at rest',
    detail: 'GitHub tokens and API keys are AES-256-GCM encrypted.',
    icon: Lock,
  },
  {
    label: 'Answer feedback',
    detail: 'Mark answers helpful or not to track quality over time.',
    icon: ThumbsUp,
  },
];

const modelProviders = [
  { name: 'OpenAI', detail: 'GPT models' },
  { name: 'Anthropic', detail: 'Claude models' },
  { name: 'Grok', detail: 'xAI models' },
  { name: 'Gemini', detail: 'Google models' },
  { name: 'Hosted AI', detail: 'No key required' },
];

const roadmap = [
  {
    label: 'Available now',
    title: 'Chat with code',
    detail: 'Repository-aware questions and living onboarding guides.',
    question: 'How does this system work?',
  },
  {
    label: 'On the roadmap',
    title: 'Understand architecture',
    detail: 'Explore dependencies, modules, and service relationships.',
    question: 'What depends on Auth?',
  },
  {
    label: 'On the roadmap',
    title: 'Remember decisions',
    detail: 'Connect code to the reasoning behind architectural choices.',
    question: 'Why was Billing extracted?',
  },
  {
    label: 'On the roadmap',
    title: 'Predict impact',
    detail: 'See affected areas and test recommendations before changes.',
    question: 'What breaks if this endpoint changes?',
  },
  {
    label: 'Long-term vision',
    title: 'Guide technical decisions',
    detail: 'A durable engineering memory layer for the organization.',
    question: 'Which trade-offs have we already considered?',
  },
];

const trustBadges = [
  { label: 'Open source', icon: Github },
  { label: 'Self-hostable', icon: ServerCog },
  { label: 'Model-agnostic', icon: KeyRound },
  { label: 'AES-256 encrypted secrets', icon: Lock },
];

const comparisonRows: Array<{
  capability: string;
  copilot: boolean | 'partial';
  cursor: boolean | 'partial';
  docs: boolean | 'partial';
  architect: boolean | 'partial';
}> = [
  { capability: 'Writes code', copilot: true, cursor: true, docs: false, architect: 'partial' },
  {
    capability: 'Understands architecture',
    copilot: 'partial',
    cursor: 'partial',
    docs: 'partial',
    architect: true,
  },
  {
    capability: 'Preserves decisions',
    copilot: false,
    cursor: false,
    docs: 'partial',
    architect: true,
  },
  {
    capability: 'Predicts change impact',
    copilot: false,
    cursor: false,
    docs: false,
    architect: true,
  },
  {
    capability: 'Source-cited answers',
    copilot: false,
    cursor: 'partial',
    docs: 'partial',
    architect: true,
  },
];

const targetCustomers = [
  {
    icon: Rocket,
    title: 'Early adopters',
    detail: '5–30 engineers, multiple repositories, growing technical complexity.',
  },
  {
    icon: Building2,
    title: 'Expansion market',
    detail: '50–500 engineers, multiple teams, significant onboarding costs.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise',
    detail: 'Self-hosted deployment, compliance controls, and advanced governance.',
  },
];

const faqs = [
  {
    question: 'Is Architect AI open source?',
    answer:
      'Yes. The full stack is open source and available on GitHub, including the API, worker, indexing pipeline, and web application.',
    requiresGithub: true,
  },
  {
    question: 'Can we self-host it?',
    answer:
      'Yes. A Docker Compose stack runs the web app, API, worker, PostgreSQL, Redis, and Qdrant on your own infrastructure, with a documented single-host production deployment for AWS EC2.',
  },
  {
    question: 'Which AI providers are supported?',
    answer:
      'Hosted AI works out of the box. Workspaces can also bring their own key for OpenAI, Anthropic, Grok, or Gemini and switch the active provider instantly—no redeploy required.',
  },
  {
    question: 'How do plans and pricing work?',
    answer:
      'Free includes hosted AI with plan-based usage limits. PRO raises those limits for a monthly price. Enterprise is custom and starts with a conversation with sales. Connecting your own model key uncaps AI questions and onboarding guides without changing the plan price.',
  },
  {
    question: 'What happens to our source code and API keys?',
    answer:
      'Repository content is parsed and embedded to power retrieval; GitHub tokens and BYOK provider keys are encrypted at rest with AES-256-GCM and are never returned in plaintext by the API.',
  },
  {
    question: 'Which languages are supported today?',
    answer:
      'TypeScript and JavaScript are parsed today via Tree-sitter, including TSX/JSX. Additional language parsers are on the roadmap.',
  },
  {
    question: 'What is the long-term vision?',
    answer:
      'Architect AI grows from repository chat into architecture exploration, decision memory, and change-impact analysis—an engineering memory layer, not just another coding assistant.',
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--landing-accent))]">
      <CircleDot className="size-3" aria-hidden="true" />
      {children}
    </p>
  );
}

function SourceReference({ source }: { source: string }) {
  return (
    <button
      type="button"
      className="group flex max-w-full items-center gap-2 truncate rounded-md border border-border/80 bg-background/75 px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-[hsl(var(--landing-accent)/.55)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Inspect source ${source}`}
    >
      <GitCommitHorizontal
        className="size-3 shrink-0 text-[hsl(var(--landing-accent))]"
        aria-hidden="true"
      />
      <span className="truncate">{source}</span>
      <ChevronRight
        className="size-3 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

function GitHubLink({
  className,
  iconClassName,
  href,
}: {
  className: string;
  iconClassName: string;
  href: string | null;
}) {
  const isDisabled = href == null;

  return (
    <a
      href={isDisabled ? undefined : href}
      target={isDisabled ? undefined : '_blank'}
      rel={isDisabled ? undefined : 'noreferrer'}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : undefined}
      title={isDisabled ? 'Repository is not public yet' : undefined}
      className={
        isDisabled
          ? `${className} cursor-not-allowed opacity-50 hover:text-muted-foreground`
          : className
      }
    >
      <Github className={iconClassName} aria-hidden="true" />
      GitHub
    </a>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string | null;
  icon: typeof Globe;
  label: string;
}) {
  const isDisabled = href == null;
  const className =
    'inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-[hsl(var(--landing-accent)/.55)] hover:bg-accent';

  if (isDisabled) {
    return (
      <span
        className={`${className} cursor-not-allowed opacity-50 hover:border-border hover:bg-card`}
        title="Link coming soon"
      >
        <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
      {label}
    </a>
  );
}

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();

    setError(null);
    setIsSubmitting(true);
    try {
      await submitContactMessage({ name, email, message });
      setSubmitted(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Unable to send your message. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  if (submitted) {
    return (
      <div className="flex min-h-[22rem] flex-col items-start justify-center rounded-xl border border-border bg-card p-6 md:p-8">
        <span className="flex size-10 items-center justify-center rounded-md border border-[hsl(var(--landing-accent)/.45)] bg-[hsl(var(--landing-accent)/.08)]">
          <Check className="size-5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-xl font-medium">Message received.</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Thanks for reaching out. I&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            placeholder="Your name"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-message" className="text-sm font-medium">
            Message
          </label>
          <Textarea
            id="contact-message"
            name="message"
            required
            rows={5}
            placeholder="How can I help?"
            className="min-h-[8.5rem] resize-y"
            disabled={isSubmitting}
          />
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        className="mt-6 h-11 w-full gap-2 self-end sm:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader className="size-4" /> : null}
        Send message
        <Send className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}

function ComparisonMark({ value }: { value: boolean | 'partial' }) {
  if (value === true) {
    return (
      <Check className="mx-auto size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
    );
  }
  if (value === 'partial') {
    return <Minus className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />;
  }
  return <span className="block text-center text-muted-foreground/50">—</span>;
}

const NAVBAR_OFFSET = 80;

export function LandingPage({
  isAuthenticated = false,
  creatorSiteUrl = null,
  creatorLinkedinUrl = null,
  githubRepoUrl = null,
}: {
  isAuthenticated?: boolean;
  creatorSiteUrl?: string | null;
  creatorLinkedinUrl?: string | null;
  githubRepoUrl?: string | null;
}) {
  const [activeQuestion, setActiveQuestion] = useState(questions[0]);
  const [activeRoadmap, setActiveRoadmap] = useState(0);
  const isGithubPublic = githubRepoUrl != null;

  const handleNavClick = useCallback((event: SyntheticEvent, link: string) => {
    event.preventDefault();

    const sectionId = link.trim().toLowerCase();
    const section = document.getElementById(sectionId);
    if (!section) return;

    const top =
      sectionId === 'top'
        ? 0
        : section.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    });

    window.history.pushState(
      null,
      '',
      sectionId === 'top' ? window.location.pathname : `#${sectionId}`,
    );
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div id="top" className="h-0 w-0 overflow-hidden" aria-hidden="true" />
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <a href="#top" onClick={(event) => handleNavClick(event, 'top')}>
            <BrandMark />
          </a>
          <nav
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
            aria-label="Main navigation"
          >
            <a
              href="#how-it-works"
              onClick={(event) => handleNavClick(event, 'how-it-works')}
              className="transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#guides"
              onClick={(event) => handleNavClick(event, 'guides')}
              className="transition-colors hover:text-foreground"
            >
              Guides
            </a>
            <a
              href="#vision"
              onClick={(event) => handleNavClick(event, 'vision')}
              className="transition-colors hover:text-foreground"
            >
              Vision
            </a>
            <a
              href="#plans"
              onClick={(event) => handleNavClick(event, 'plans')}
              className="transition-colors hover:text-foreground"
            >
              Plans
            </a>
            <a
              href="#faq"
              onClick={(event) => handleNavClick(event, 'faq')}
              className="transition-colors hover:text-foreground"
            >
              FAQ
            </a>
            <a
              href="#contact"
              onClick={(event) => handleNavClick(event, 'contact')}
              className="transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <GitHubLink
              className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              iconClassName="size-4"
              href={githubRepoUrl}
            />
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-md bg-[#29903B] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                >
                  Sign up
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-9 items-center rounded-md bg-[#29903B] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative border-b border-border/70">
        <div className="container grid gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,.86fr)_minmax(440px,1.14fr)] lg:items-center lg:gap-16 lg:py-28">
          <div>
            <SectionEyebrow>Engineering memory for software teams</SectionEyebrow>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
              The code is there.{' '}
              <span className="text-muted-foreground">The context is missing.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Architect AI helps your team understand how systems work, preserve why they were
              built, and onboard without relying on tribal knowledge.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={isAuthenticated ? '/dashboard' : '/sign-up'}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#29903B] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isAuthenticated ? 'Open dashboard' : 'Start with one repository'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                onClick={(event) => handleNavClick(event, 'how-it-works')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                See how it works
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck
                className="size-3.5 text-[hsl(var(--landing-accent))]"
                aria-hidden="true"
              />
              Repository-scoped answers with source references.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {(isGithubPublic
                ? trustBadges
                : trustBadges.filter((badge) => badge.label !== 'Open source')
              ).map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Icon className="size-3.5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
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
                <p className="mb-3 text-foreground">Repository map</p>
                {[
                  'src/auth',
                  'src/workspaces',
                  'src/repositories',
                  'src/retrieval',
                  'src/chat',
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 rounded-md px-2 py-2 ${index === 0 ? 'bg-accent text-foreground' : ''}`}
                  >
                    <GitBranch
                      className="size-3 text-[hsl(var(--landing-accent))]"
                      aria-hidden="true"
                    />
                    {item}
                  </div>
                ))}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-[10px]">
                  <Check className="size-3 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                  1,248 symbols understood
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Ask your system
                </div>
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
            <div className="flex flex-wrap gap-2 border-t border-border px-2 pt-4">
              {questions.map((question) => (
                <button
                  key={question.label}
                  type="button"
                  onClick={() => setActiveQuestion(question)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeQuestion.label === question.label ? 'border-[hsl(var(--landing-accent)/.55)] bg-[hsl(var(--landing-accent)/.08)] text-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}
                >
                  {question.label}
                </button>
              ))}
            </div>
          </div>
          {isAuthenticated && (
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Network className="size-3.5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
              You are signed in · Open your workspace dashboard
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section className="border-b border-border/70 py-20 md:py-28">
        <div className="container grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <SectionEyebrow>The memory problem</SectionEyebrow>
            <h2 className="max-w-lg text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Growing codebases outlive the people who understand them.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Weeks to onboard', 'New engineers reconstruct the system from fragments.'],
              ['Knowledge in heads', 'Senior engineers become the undocumented interface.'],
              ['Decisions revisited', 'Teams lose the reasoning behind what already works.'],
            ].map(([title, detail]) => (
              <div key={title} className="border-l-2 border-border pl-4">
                <p className="font-mono text-xs text-[hsl(var(--landing-accent))]">{title}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <SectionEyebrow>From repository to understanding</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Ask the system, not the hallway.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Architect AI turns a live codebase into a searchable, explainable context layer your
              whole team can use.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {pipeline.map(({ label, detail, icon: Icon }, index) => (
              <div key={label} className="bg-card p-6">
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                  <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-12 font-medium">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
            {['cloning', 'parsing', 'chunking', 'embedding', 'ready'].map((status, index) => (
              <span key={status} className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${index === 4 ? 'bg-[hsl(var(--landing-accent))]' : 'bg-muted-foreground/50'}`}
                />
                {status}
              </span>
            ))}
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {capabilities.map(({ label, detail, icon: Icon }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-accent/30 py-20 md:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--landing-accent))]">
              <CircleDot className="size-3" aria-hidden="true" />
              Model-agnostic by design
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Use the model you trust.
            </h2>
            <p className="mt-3 text-lg font-medium text-muted-foreground">
              We don&apos;t care who wins the AI wars.
            </p>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Architect AI is model-agnostic. Bring your own provider, use hosted AI, or switch
              models whenever you want—your workspace, your call.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {modelProviders.map(({ name, detail }) => (
              <div
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
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Switch your active provider anytime from workspace settings—no redeploy, no lock-in.
          </p>
        </div>
      </section>

      <section id="guides" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
        <div className="container grid items-center gap-12 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <SectionEyebrow>Living onboarding guides</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              A guide for every unfamiliar system.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Every ready repository gets nine guide types—executive summary, project overview,
              folders, modules, services, technology stack, reading order, glossary, and
              pitfalls—generated automatically and regenerated on demand, all grounded in the
              repository and ready to ask questions from.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--landing-accent))] hover:underline"
            >
              Generate a living guide <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />{' '}
                Guide library
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">v3 · READY</span>
            </div>
            <div className="grid md:grid-cols-[.72fr_1.28fr]">
              <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                {[
                  'Executive summary',
                  'Project overview',
                  'Modules & services',
                  'Technology stack',
                  'Reading order',
                  'Glossary',
                  'Common pitfalls',
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`flex items-center justify-between rounded-md px-3 py-2.5 text-xs ${index === 0 ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'}`}
                  >
                    {item}
                    {index === 0 && <ChevronRight className="size-3" aria-hidden="true" />}
                  </div>
                ))}
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--landing-accent))]">
                  Executive summary
                </p>
                <h3 className="mt-3 text-xl font-medium">How Architect AI fits together</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  A decision-oriented overview of purpose, boundaries, core flows, and open risks—
                  grounded in the repository and ready for source-cited follow-up questions.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    'Connect a repository',
                    'Let indexing build context',
                    'Ask your first system question',
                  ].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 text-sm">
                      <span className="flex size-5 items-center justify-center rounded-full border border-[hsl(var(--landing-accent)/.45)] font-mono text-[10px] text-[hsl(var(--landing-accent))]">
                        {index + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-7 inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ask AI about this guide <MessageSquare className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-accent/30 py-20 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <SectionEyebrow>Explainable by design</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Every answer has a trail back to the code.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              The goal is not to replace engineering judgment. It is to give that judgment better
              context—scoped to the repository or workspace you are actually working in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Repository-scoped', 'Workspace-wide', 'Source references'].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <Check className="size-3 text-[hsl(var(--landing-accent))]" aria-hidden="true" />{' '}
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-4 text-xs">
              <span className="flex items-center gap-2 font-medium">
                <TerminalSquare
                  className="size-4 text-[hsl(var(--landing-accent))]"
                  aria-hidden="true"
                />{' '}
                Source-grounded answer
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">REPOSITORY: API</span>
            </div>
            <div className="mt-5 rounded-md bg-accent p-3 font-mono text-xs">
              Which services use Redis?
            </div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              Redis is used for repository indexing queues and optional retrieval caching. The
              indexing worker publishes jobs through BullMQ, while retrieval can cache query
              embeddings and assembled context.
            </p>
            <div className="mt-5 space-y-2">
              <SourceReference source="apps/api/src/indexing-worker.ts" />
              <SourceReference source="apps/api/src/modules/retrieval/retrieval.service.ts" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <SectionEyebrow>Not another coding assistant</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Coding assistants write code. Architect AI explains the system.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Copilot and Cursor answer &ldquo;how do I write this faster?&rdquo; Architect AI
              answers &ldquo;how does this system work, and what happens if we change it?&rdquo;
            </p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/40">
                  <th className="p-4 text-left font-medium text-muted-foreground">Capability</th>
                  <th className="p-4 text-center font-medium text-muted-foreground">
                    GitHub Copilot
                  </th>
                  <th className="p-4 text-center font-medium text-muted-foreground">Cursor</th>
                  <th className="p-4 text-center font-medium text-muted-foreground">Docs tools</th>
                  <th className="p-4 text-center font-medium text-foreground">Architect AI</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr
                    key={row.capability}
                    className={index !== comparisonRows.length - 1 ? 'border-b border-border' : ''}
                  >
                    <td className="p-4 text-foreground">{row.capability}</td>
                    <td className="p-4">
                      <ComparisonMark value={row.copilot} />
                    </td>
                    <td className="p-4">
                      <ComparisonMark value={row.cursor} />
                    </td>
                    <td className="p-4">
                      <ComparisonMark value={row.docs} />
                    </td>
                    <td className="p-4 bg-[hsl(var(--landing-accent)/.06)]">
                      <ComparisonMark value={row.architect} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Based on our own product research; other tools evolve quickly and may close these gaps
            over time.
          </p>
        </div>
      </section>

      <section className="border-b border-border/70 bg-accent/30 py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <SectionEyebrow>Who it&apos;s for</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Built for teams that outgrow tribal knowledge.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {targetCustomers.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="vision" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <SectionEyebrow>The product journey</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              From chat with code to engineering memory.
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Start with the questions your team is already asking. Grow toward a system that
              remembers the reasoning behind the software.
            </p>
          </div>
          <div className="mt-12 grid gap-3 lg:grid-cols-5">
            {roadmap.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setActiveRoadmap(index)}
                className={`group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeRoadmap === index ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                <div
                  className={`mb-5 h-1 rounded-full transition-colors ${activeRoadmap === index ? 'bg-[hsl(var(--landing-accent))]' : 'bg-border group-hover:bg-muted-foreground/40'}`}
                />
                <span className="font-mono text-[10px] uppercase tracking-[.12em]">
                  {item.label}
                </span>
                <h3 className="mt-3 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-6">{item.detail}</p>
              </button>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles
                className="mt-0.5 size-4 shrink-0 text-[hsl(var(--landing-accent))]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">The question this stage should answer</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {roadmap[activeRoadmap].question}
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">
              {String(activeRoadmap + 1).padStart(2, '0')} / 05
            </span>
          </div>
        </div>
      </section>

      <LandingPlansSection isAuthenticated={isAuthenticated} />

      <section
        id="faq"
        className="scroll-mt-20 border-b border-border/70 bg-accent/30 py-20 md:py-28"
      >
        <div className="container">
          <div className="max-w-2xl">
            <SectionEyebrow>Frequently asked</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Questions teams ask before connecting a repository.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {faqs
              .filter((faq) => isGithubPublic || !faq.requiresGithub)
              .map(({ question, answer }) => (
                <div key={question} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-medium">{question}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-20 md:py-28">
        <div className="container">
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <SectionEyebrow>Start with what you already have</SectionEyebrow>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Connect one repository. Find the answers your team keeps rediscovering.
                </h2>
                <p className="mt-5 max-w-xl text-muted-foreground">
                  Make the system legible before the next engineer has to learn it the hard way.
                </p>
              </div>
              <Link
                href={isAuthenticated ? '/dashboard' : '/sign-up'}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#29903B] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isAuthenticated ? 'Open dashboard' : 'Connect a repository'}{' '}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="scroll-mt-20 border-b border-border/70 bg-accent/30 py-20 md:py-28"
      >
        <div className="container grid items-start gap-12 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <SectionEyebrow>Get in touch</SectionEyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Let&apos;s talk.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Questions about Architect AI, partnerships, or just saying hello—send a message or
              find me on the web.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ProfileLink href={creatorSiteUrl} icon={Globe} label="My Landing" />
              <ProfileLink href={creatorLinkedinUrl} icon={Linkedin} label="LinkedIn" />
            </div>
          </div>
          {/* TODO: Specify email address */}
          {/* CONTACT_TO_EMAIL=you@your-resend-account.com
              MAIL_FROM='Architect AI <onboarding@resend.dev>' */}
          {/* Testing domain restriction: The resend.dev domain
              is for testing and can only send to your own email address.
              To send to other recipients, verify a domain and update the from address to use it. */}

           <ContactForm />
        </div>
      </section>

      <footer className="py-8">
        <div className="container flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <p className="font-mono">Architect AI · From chat with code to engineering memory</p>
          <p>© {new Date().getFullYear()} Architect AI. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
