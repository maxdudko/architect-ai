'use client';

import Link from 'next/link';
import { AlertTriangle, BookOpen, Bot, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useRepositoryQuery } from '@/features/repository';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/shared/components';
import { cn } from '@/lib/utils';
import {
  useGenerateOnboardingGuidesMutation,
  useLatestOnboardingGuideRunQuery,
  useOnboardingGuideQuery,
  useOnboardingGuidesQuery,
  useRegenerateOnboardingGuidesMutation,
} from '../hooks/use-onboarding-guides';
import { extractMarkdownHeadings } from '../utils/markdown-headings';
import { getDefaultGuide, groupGuides, GUIDE_TYPE_LABELS } from '../utils/guide-tree';
import { GuideMarkdown } from './guide-markdown';

interface OnboardingGuidesViewProps {
  repositoryId: string;
  guideId?: string;
}

function GenerationProgress({ completed, total }: { completed: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 8;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <Sparkles className="size-5 animate-pulse text-[#29903B]" />
        <div>
          <p className="font-medium">Building your living guides</p>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${completed} of ${total} guides complete`
              : 'Analyzing repository context…'}
          </p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full bg-[#29903B] transition-all',
            total === 0 && 'animate-pulse',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

export function OnboardingGuidesView({ repositoryId, guideId }: OnboardingGuidesViewProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const repositoryQuery = useRepositoryQuery(workspaceId, repositoryId);
  const guidesQuery = useOnboardingGuidesQuery(workspaceId, repositoryId);
  const guideQuery = useOnboardingGuideQuery(workspaceId, repositoryId, guideId ?? '');
  const latestRunQuery = useLatestOnboardingGuideRunQuery(workspaceId, repositoryId);
  const generateMutation = useGenerateOnboardingGuidesMutation(workspaceId, repositoryId);
  const regenerateMutation = useRegenerateOnboardingGuidesMutation(workspaceId, repositoryId);

  const guides = guidesQuery.data?.guides ?? [];
  const selectedGuide = guideId ? guideQuery.data : getDefaultGuide(guides);
  const run = latestRunQuery.data;
  const isGenerating = run?.status === 'QUEUED' || run?.status === 'RUNNING';
  const isMutating = generateMutation.isPending || regenerateMutation.isPending;

  async function generate(regenerate = false) {
    try {
      if (regenerate) await regenerateMutation.mutateAsync(undefined);
      else await generateMutation.mutateAsync(undefined);
      toast.success(regenerate ? 'Guide regeneration started.' : 'Guide generation started.');
    } catch {
      toast.error('Unable to start guide generation.');
    }
  }

  if (!workspaceId) {
    return (
      <EmptyState
        title="Select a workspace"
        description="Choose a workspace before viewing repository guides."
      />
    );
  }

  if (repositoryQuery.isLoading || guidesQuery.isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (repositoryQuery.isError || !repositoryQuery.data) {
    return (
      <ErrorState
        title="Repository not found"
        description="This repository is unavailable in the active workspace."
        action={
          <Link href="/repositories" className="text-sm underline">
            Back to repositories
          </Link>
        }
      />
    );
  }

  const repository = repositoryQuery.data;

  if (repository.status !== 'READY') {
    return (
      <div>
        <PageHeader title="Living onboarding guides" description={repository.fullName} />
        <EmptyState
          title="Repository is not ready"
          description="Guides can be generated after repository indexing completes successfully."
          action={
            <Button asChild variant="outline">
              <Link href={`/repositories/${repositoryId}`}>View indexing status</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (guidesQuery.isError) {
    return (
      <ErrorState
        title="Guides are unavailable"
        description="We could not load the onboarding guides for this repository."
        action={<Button onClick={() => void guidesQuery.refetch()}>Try again</Button>}
      />
    );
  }

  if (isGenerating && guides.length === 0) {
    return (
      <div>
        <PageHeader title="Living onboarding guides" description={repository.fullName} />
        <GenerationProgress
          completed={run?.completedGuideCount ?? 0}
          total={run?.totalGuideCount ?? 0}
        />
      </div>
    );
  }

  if (run?.status === 'FAILED' && guides.length === 0) {
    return (
      <div>
        <PageHeader title="Living onboarding guides" description={repository.fullName} />
        <ErrorState
          title="Guide generation failed"
          description={run.error ?? 'The repository guide set could not be generated.'}
          action={
            <Button disabled={isMutating} onClick={() => void generate(true)}>
              <RefreshCw className="mr-2 size-4" />
              Retry generation
            </Button>
          }
        />
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div>
        <PageHeader title="Living onboarding guides" description={repository.fullName} />
        <EmptyState
          title="No guides yet"
          description="Generate a structured, repository-aware onboarding guide set for your team."
          action={
            <Button disabled={isMutating} onClick={() => void generate()}>
              <Sparkles className="mr-2 size-4" />
              Generate guides
            </Button>
          }
        />
      </div>
    );
  }

  if (guideId && guideQuery.isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (guideId && (guideQuery.isError || !selectedGuide)) {
    return (
      <ErrorState
        title="Guide not found"
        description="This guide does not exist or is unavailable in the active workspace."
        action={
          <Button asChild variant="outline">
            <Link href={`/repositories/${repositoryId}/guides`}>Open guide library</Link>
          </Button>
        }
      />
    );
  }

  if (!selectedGuide) return null;

  const groups = groupGuides(guides);
  const headings = extractMarkdownHeadings(selectedGuide.markdown);
  const isStale =
    Boolean(repository.lastIndexedAt) &&
    Date.parse(repository.lastIndexedAt ?? '') > Date.parse(selectedGuide.updatedAt);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Living onboarding guides"
        description={`${repository.fullName} · ${GUIDE_TYPE_LABELS[selectedGuide.type]}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/chat?repositoryId=${repositoryId}`}>
                <Bot className="mr-2 size-4" />
                Ask AI
              </Link>
            </Button>
            <Button disabled={isMutating || isGenerating} onClick={() => void generate(true)}>
              <RefreshCw className={cn('mr-2 size-4', isMutating && 'animate-spin')} />
              Regenerate
            </Button>
          </>
        }
      />

      {isGenerating ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#29903B]/30 bg-[#29903B]/5 px-4 py-3 text-sm">
          <Sparkles className="size-4 animate-pulse text-[#29903B]" />
          Refreshing guides: {run?.completedGuideCount ?? 0} of {run?.totalGuideCount || '…'}{' '}
          complete.
        </div>
      ) : null}

      {run?.status === 'FAILED' && !isGenerating ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Latest regeneration failed</p>
            <p className="text-muted-foreground">
              {run.error ?? 'The previous guide set is still available. Retry to refresh it.'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isMutating}
            onClick={() => void generate(true)}
          >
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {isStale ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">This guide may be out of date</p>
            <p className="text-muted-foreground">
              The repository was indexed after this guide was generated. Regenerate to refresh it.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-5 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <BookOpen className="size-4" />
              Guide library
            </div>
            {groups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.guides.map((guide) => (
                  <Link
                    key={guide.id}
                    href={`/repositories/${repositoryId}/guides/${guide.id}`}
                    className={cn(
                      'block rounded-md px-2 py-2 text-sm transition-colors',
                      guide.id === selectedGuide.id
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <span className="block">{guide.title}</span>
                    {group.label === 'Overview' ||
                    group.label === 'Folders' ||
                    group.label === 'Knowledge' ? (
                      <span className="block text-xs">{GUIDE_TYPE_LABELS[guide.type]}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Card>
            <CardContent className="p-5 sm:p-8">
              <div className="mb-8 border-b pb-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{GUIDE_TYPE_LABELS[selectedGuide.type]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Version {selectedGuide.generationVersion}
                  </span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight">{selectedGuide.title}</h1>
                {selectedGuide.summary ? (
                  <p className="mt-3 text-muted-foreground">{selectedGuide.summary}</p>
                ) : null}
              </div>

              {headings.length > 0 ? (
                <nav
                  aria-label="Table of contents"
                  className="mb-8 rounded-lg border bg-muted/30 p-4"
                >
                  <p className="mb-2 text-sm font-semibold">On this page</p>
                  <ol className="grid gap-1 text-sm sm:grid-cols-2">
                    {headings.map((heading) => (
                      <li
                        key={`${heading.slug}-${heading.depth}`}
                        style={{ paddingLeft: `${(heading.depth - 2) * 0.75}rem` }}
                      >
                        <a
                          href={`#${heading.slug}`}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}

              <GuideMarkdown markdown={selectedGuide.markdown} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
