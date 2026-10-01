import { KeyRound, Lock, ServerCog, Users } from 'lucide-react';
import { SectionEyebrow } from './landing-ui';

const controls = [
  {
    title: 'Encrypted secrets',
    detail:
      'GitHub credentials and provider keys are encrypted at rest with AES-256-GCM. The API returns a key hint, not the secret.',
    icon: Lock,
  },
  {
    title: 'Bring your own AI',
    detail:
      'A workspace owner or admin can store provider keys and choose which model answers. Invalid keys fail the request. They do not fall back to Hosted AI.',
    icon: KeyRound,
  },
  {
    title: 'Self-host',
    detail:
      'Docker Compose runs the web app, API, indexing worker, PostgreSQL, Redis, and Qdrant on your infrastructure. Production docs cover a single host. Kubernetes and air-gapped deployment are not supported today.',
    icon: ServerCog,
  },
  {
    title: 'Scoped access',
    detail:
      'Workspaces use owner, admin, member, and viewer roles. Chat and architecture stay inside that workspace. A repository in another workspace is not returned.',
    icon: Users,
  },
];

export function SecuritySection() {
  return (
    <section
      id="security"
      className="scroll-mt-20 border-b border-border/70 bg-accent/30 py-20 md:py-28"
    >
      <div className="container">
        <div className="max-w-2xl">
          <SectionEyebrow>Security and control</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Your code stays under your control.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Connecting a repository clones it long enough to index, then removes the checkout.
            Parsed structure and embeddings remain so the workspace can keep answering. There is no
            claim here of a compliance certification.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {controls.map(({ title, detail, icon: Icon }) => (
            <li key={title} className="rounded-xl border border-border bg-card p-6">
              <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
