'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ArchitectureSearchAnswer, EpistemicLabel } from '@/entities';
import { submitAnswerFeedback, streamArchitectureSearch } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/shared/components';
import { useRepositoryQuery } from '@/features/repository';
import {
  ARCHITECTURE_QUERY_KEYS,
  useArchitectureSearchQuery,
} from '../services/architecture.service';
import { describeBound } from '../utils/dependency-map-presentation';
import {
  describeAnswerEpistemic,
  describeEpistemic,
  describeSearchIntent,
} from '../utils/architecture-search-presentation';
import { ArchitectureSectionNav } from './architecture-section-nav';

interface ArchitectureSearchViewProps {
  repositoryId: string;
}

export function ArchitectureSearchView({ repositoryId }: ArchitectureSearchViewProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const canAsk = activeWorkspace?.role !== 'VIEWER';
  const queryClient = useQueryClient();
  const repositoryQuery = useRepositoryQuery(workspaceId, repositoryId);
  const threadQuery = useArchitectureSearchQuery(workspaceId, repositoryId);
  const [question, setQuestion] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workspaceId) {
    return (
      <EmptyState
        title="No active workspace"
        description="Select a workspace to ask about repository architecture."
      />
    );
  }

  if (threadQuery.isLoading || repositoryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (threadQuery.isError || !threadQuery.data) {
    return (
      <ErrorState
        title="Architecture search unavailable"
        description="The architecture questions for this repository could not be loaded."
        action={
          <Button variant="outline" onClick={() => void threadQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const thread = threadQuery.data;
  const repositoryName = repositoryQuery.data?.fullName ?? 'Repository';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = question.trim();
    if (!content || pending || !canAsk) {
      return;
    }
    setPending(true);
    setError(null);
    setStreamingText('');
    let failed = false;
    try {
      await streamArchitectureSearch(workspaceId, repositoryId, content, {
        onToken: (text) => setStreamingText((current) => current + text),
        onError: (message) => {
          failed = true;
          setError(message);
        },
        onMessage: () => {
          setStreamingText('');
          void queryClient.invalidateQueries({
            queryKey: ARCHITECTURE_QUERY_KEYS.search(workspaceId, repositoryId),
          });
        },
      });
      if (!failed) {
        setQuestion('');
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Architecture search could not answer that question.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ArchitectureSectionNav repositoryId={repositoryId} section="search" />
      <PageHeader
        title="Architecture search"
        description={`Questions about modules in ${repositoryName}. Structural answers come from the dependency map.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/repositories/${repositoryId}`}>Back to repository</Link>
          </Button>
        }
      />

      {thread.latestRevision ? (
        <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">
            New questions use indexing revision{' '}
            {thread.latestRevision.commitSha ?? thread.latestRevision.indexingRunId}
            {thread.latestRevision.branch ? ` on ${thread.latestRevision.branch}` : ''}.
          </p>
          {thread.rebuildInProgress ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              A newer indexing run is in progress. Questions stay on the revision above until that
              run succeeds.
            </p>
          ) : null}
        </div>
      ) : null}

      {!thread.indexingAvailable ? (
        <EmptyState
          title="Architecture search is unavailable"
          description="This repository has no successful indexing revision yet. Check its indexing state before asking a question."
        />
      ) : null}

      {thread.indexingAvailable && thread.turns.length === 0 && !streamingText ? (
        <p className="text-sm text-muted-foreground">
          Ask what depends on a module, what a module depends on, or which modules reference a file.
          Runtime questions, such as brokers or traffic, are reported as not establishable.
        </p>
      ) : null}

      <div className="space-y-4">
        {thread.turns.map((turn) => (
          <article key={`${turn.askedAt}-${turn.question}`} className="space-y-2">
            <p className="text-sm font-medium">{turn.question}</p>
            {turn.answer ? (
              <AnswerCard
                workspaceId={workspaceId}
                repositoryId={repositoryId}
                answer={turn.answer}
                canRate={canAsk}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This question did not receive an answer. Ask it again.
              </p>
            )}
          </article>
        ))}
        {streamingText ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Answering</CardTitle>
              <CardDescription>This answer is still being written.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {error ? (
        <ErrorState
          title="Architecture search could not finish"
          description={error}
          action={
            canAsk ? (
              <Button variant="outline" onClick={() => setError(null)}>
                Dismiss
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {canAsk && thread.indexingAvailable ? (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What depends on billing?"
            maxLength={2000}
            rows={3}
            disabled={pending}
          />
          <Button type="submit" disabled={pending || question.trim().length === 0}>
            {pending ? 'Asking…' : 'Ask'}
          </Button>
        </form>
      ) : null}

      {thread.indexingAvailable && !canAsk ? (
        <p className="text-sm text-muted-foreground">
          You can read architecture answers. Asking a new question requires a member role.
        </p>
      ) : null}
    </div>
  );
}

function AnswerCard({
  workspaceId,
  repositoryId,
  answer,
  canRate,
}: {
  workspaceId: string;
  repositoryId: string;
  answer: ArchitectureSearchAnswer;
  canRate: boolean;
}) {
  const dependencyNotice = describeBound(answer.dependencyBounds, 'dependencies');
  const dependentNotice = describeBound(answer.dependentBounds, 'dependents');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {describeSearchIntent(answer.intent)}
          <EpistemicBadge label={answer.epistemic} />
        </CardTitle>
        <CardDescription>
          Revision {answer.revision.commitSha ?? answer.revision.indexingRunId}
          {answer.historical ? ' · historical revision' : ''}
          {answer.truncated ? ' · incomplete answer' : ''}
          {answer.contextTruncated ? ' · context was bounded' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm">{answer.content}</p>
        <p className="text-xs text-muted-foreground">
          {describeAnswerEpistemic(answer.epistemic, answer.findings.length)}
        </p>

        {answer.entityResolution.outcome === 'AMBIGUOUS' ||
        answer.entityResolution.outcome === 'NOT_FOUND' ? (
          <ul className="space-y-1 text-sm">
            {answer.entityResolution.candidates.map((candidate) => (
              <li key={candidate.key}>
                {candidate.name} <span className="text-muted-foreground">({candidate.path})</span>
              </li>
            ))}
          </ul>
        ) : null}

        {answer.findings.length > 0 ? (
          <ul className="space-y-3">
            {answer.findings.map((finding) => (
              <li
                key={`${finding.direction}-${finding.relatedModuleKey}`}
                className="rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {finding.direction === 'DEPENDENT' ? 'Depended on by' : 'Depends on'}{' '}
                    <span className="font-medium">{finding.relatedModuleName}</span>
                  </span>
                  <EpistemicBadge label="OBSERVED" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {finding.supportingRelationCount} import
                  {finding.supportingRelationCount === 1 ? '' : 's'} · {finding.confidence}
                </p>
                <ul className="mt-2 space-y-1">
                  {finding.evidence.map((item) => (
                    <li key={`${item.filePath}-${item.qualifiedName ?? item.name}`}>
                      <Link
                        href={fileHref(repositoryId, item.filePath)}
                        className="text-xs underline"
                      >
                        {item.filePath}
                        {item.name ? ` · ${item.name}` : ''}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}

        {dependencyNotice ? (
          <p className="text-xs text-muted-foreground">{dependencyNotice}</p>
        ) : null}
        {dependentNotice ? (
          <p className="text-xs text-muted-foreground">{dependentNotice}</p>
        ) : null}

        {answer.retrievedEvidence.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Retrieved source</h3>
              <EpistemicBadge label="INTERPRETED" />
            </div>
            <ul className="space-y-1">
              {answer.retrievedEvidence.map((item) => (
                <li key={`${item.filePath}-${item.startLine ?? ''}`}>
                  <Link href={fileHref(repositoryId, item.filePath)} className="text-xs underline">
                    {item.filePath}
                    {item.startLine != null ? `:${item.startLine}` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {answer.limitations.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {answer.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}

        {canRate ? (
          <FeedbackControls
            workspaceId={workspaceId}
            conversationId={answer.conversationId}
            messageId={answer.assistantMessageId}
            rating={answer.feedbackRating}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function EpistemicBadge({ label }: { label: EpistemicLabel }) {
  const presentation = describeEpistemic(label);
  return (
    <Badge variant="outline" title={presentation.description} className={presentation.className}>
      {presentation.label}
    </Badge>
  );
}

function FeedbackControls({
  workspaceId,
  conversationId,
  messageId,
  rating,
}: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  rating: ArchitectureSearchAnswer['feedbackRating'];
}) {
  const [current, setCurrent] = useState(rating);
  const [pending, setPending] = useState(false);

  async function rate(next: 'HELPFUL' | 'NOT_HELPFUL') {
    setPending(true);
    try {
      await submitAnswerFeedback(workspaceId, conversationId, messageId, next);
      setCurrent(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-t pt-3">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Helpful"
        aria-pressed={current === 'HELPFUL'}
        disabled={pending}
        onClick={() => void rate('HELPFUL')}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Not helpful"
        aria-pressed={current === 'NOT_HELPFUL'}
        disabled={pending}
        onClick={() => void rate('NOT_HELPFUL')}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function fileHref(repositoryId: string, filePath: string): string {
  const params = new URLSearchParams({
    file: filePath,
    returnTo: `/repositories/${repositoryId}/architecture/search`,
  });
  return `/repositories/${repositoryId}?${params.toString()}`;
}
