import { SectionEyebrow } from './landing-ui';

const faqs = [
  {
    question: 'Is Architect AI open source?',
    answer:
      'Yes. This repository is licensed under Apache-2.0 and includes the API, indexing worker, and web application.',
    requiresGithub: true,
  },
  {
    question: 'Can we self-host it?',
    answer:
      'Yes. Docker Compose runs the web app, API, indexing worker, PostgreSQL, Redis, and Qdrant. Documented production deploys are single-host. Kubernetes and air-gapped deployment are not supported.',
  },
  {
    question: 'Which AI providers are supported?',
    answer:
      'Hosted AI works without a workspace key. Owners and admins can also save OpenAI, Anthropic, Gemini, or Grok keys and switch the active provider without a redeploy. Embeddings stay on the platform embedding provider.',
  },
  {
    question: 'How do plans and pricing work?',
    answer:
      'Free includes Hosted AI with plan limits. PRO raises those limits for a monthly price. Enterprise is custom and starts with sales. Your own model key uncaps AI questions and onboarding guides. Repository, indexing, and member limits still follow the plan.',
  },
  {
    question: 'What happens to our source code and API keys?',
    answer:
      'A repository is cloned to index, then the checkout is removed. Parsed structure and embeddings remain for retrieval. GitHub tokens and provider keys are encrypted at rest with AES-256-GCM and are not returned in plaintext.',
  },
  {
    question: 'Which languages are supported today?',
    answer:
      'TypeScript, JavaScript, Python, and PHP are parsed with Tree-sitter, including TSX and JSX. Architecture edges can resolve for TypeScript, JavaScript, and Python imports. PHP imports do not produce module edges yet.',
  },
  {
    question: 'What does Architecture Explorer show?',
    answer:
      'Folder modules from the first two path segments, edges for resolved imports between them, questions about those dependencies, and a system overview grounded in that graph. It does not show packages, services, runtime behavior, or change impact.',
  },
];

export function FaqSection({ isGithubPublic }: { isGithubPublic: boolean }) {
  const visible = faqs.filter((faq) => isGithubPublic || !faq.requiresGithub);

  return (
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
          {visible.map(({ question, answer }) => (
            <div key={question} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
