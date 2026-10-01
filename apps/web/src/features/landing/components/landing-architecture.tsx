import { Network } from 'lucide-react';
import { SectionEyebrow, SourceReference } from './landing-ui';

const modules = [
  {
    path: 'apps/api',
    selected: true,
    note: 'Selected folder module',
    files: [
      'src/auth/auth.module.ts',
      'src/workspaces/workspaces.module.ts',
      'src/repositories/repositories.module.ts',
    ],
  },
  {
    path: 'apps/web',
    selected: false,
    note: 'Separate folder module',
    files: [],
  },
  {
    path: 'packages/ui',
    selected: false,
    note: 'Separate folder module',
    files: [],
  },
];

const explorerSections = ['Dependency map', 'Search', 'Overview'];

export function ArchitectureExplorerPreview() {
  return (
    <section id="architecture" className="scroll-mt-20 border-b border-border/70 py-20 md:py-28">
      <div className="container grid items-start gap-12 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <SectionEyebrow>Architecture Explorer</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            See how the system fits together.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            This is more than chat with a repository. The explorer groups indexed files into folder
            modules and draws an edge only when an import resolves into another module.
          </p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            A module is the first two path segments, and only when that folder holds at least two
            indexed files. In this repository, authentication, workspaces, and repositories are
            inside <span className="font-mono text-xs text-foreground">apps/api</span>. Imports
            among them stay internal. They are not drawn as a service chain.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Network className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
              architect-ai
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Architecture Explorer sections">
              {explorerSections.map((section, index) => (
                <li key={section}>
                  <span
                    className={`inline-flex rounded-md border px-2 py-1 text-xs ${index === 0 ? 'border-foreground bg-accent text-foreground' : 'border-border text-muted-foreground'}`}
                  >
                    {section}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid lg:grid-cols-[.92fr_1.08fr]">
            <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                Folder modules
              </p>
              <ul className="space-y-2">
                {modules.map((module) => (
                  <li
                    key={module.path}
                    className={`rounded-lg border px-3 py-2 ${module.selected ? 'border-foreground bg-background' : 'border-border'}`}
                  >
                    <p className="font-mono text-xs text-foreground">{module.path}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{module.note}</p>
                    {module.files.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-border pt-2">
                        {module.files.map((file) => (
                          <li
                            key={file}
                            className="truncate font-mono text-[11px] text-muted-foreground"
                          >
                            {file}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 md:p-5">
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                Search
              </p>
              <div className="mt-3 rounded-md bg-accent px-3 py-2 font-mono text-xs">
                What depends on authentication?
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The name matches code in{' '}
                <span className="font-mono text-xs text-foreground">apps/api/src/auth</span>, part
                of the <span className="font-mono text-xs text-foreground">apps/api</span> folder
                module. A dependent appears only when a resolved import points at that module, and
                the result includes that import evidence. A similar name, a retrieval hit, or a
                function call does not create an edge.
              </p>
              <div className="mt-5 space-y-2">
                <SourceReference source="apps/api/src/auth/auth.module.ts" />
                <SourceReference source="apps/api/src/modules/architecture/architecture-search/structural-query.ts" />
              </div>
            </div>
          </div>

          <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
            Scope today: resolved imports between folder modules in one indexing revision.
            TypeScript, JavaScript, and Python imports can resolve. PHP is indexed, and its imports
            do not produce module edges yet. Not packages, services, runtime tracing, or change
            impact. A missing edge means no import was observed.
          </p>
        </div>
      </div>
    </section>
  );
}
