'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { GuideMarkdown } from '@/features/onboarding/components/guide-markdown';
import { useRepositoryQuery } from '@/features/repository';
import { generateSystemOverview, regenerateSystemOverview } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuth } from '@/providers/auth-provider';
import {
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
} from '@/shared/components';
import { ARCHITECTURE_QUERY_KEYS, useSystemOverviewQuery } from '../services/architecture.service';
import {
  describeOverviewAvailability,
  describeOverviewProgress,
  linkCitedPaths,
} from '../utils/system-overview-presentation';
import { ArchitectureSectionNav } from './architecture-section-nav';

interface SystemOverviewViewProps {
  repositoryId: string;
}

export function SystemOverviewView({ repositoryId }: SystemOverviewViewProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const canGenerate = activeWorkspace?.role !== 'VIEWER';
  const queryClient = useQueryClient();
  const repositoryQuery = useRepositoryQuery(workspaceId, repositoryId);
  const overviewQuery = useSystemOverviewQuery(workspaceId, repositoryId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workspaceId) {
    return (
      <EmptyState
        title="No active workspace"
        description="Select a workspace to read a repository system overview."
      />
    );
  }

  if (overviewQuery.isLoading || repositoryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        title="System overview unavailable"
        description="The system overview for this repository could not be loaded."
        action={
          <Button variant="outline" onClick={() => void overviewQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const overview = overviewQuery.data;
  const repositoryName = repositoryQuery.data?.fullName ?? 'Repository';
  const availability = describeOverviewAvailability(overview);
  const progress = describeOverviewProgress(overview);
  const document = overview.overview;

  async function requestGeneration(regenerate: boolean) {
    if (!canGenerate || pending || !overview.generationAllowed) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (regenerate) {
        await regenerateSystemOverview(workspaceId, repositoryId);
      } else {
        await generateSystemOverview(workspaceId, repositoryId);
      }
      await queryClient.invalidateQueries({
        queryKey: ARCHITECTURE_QUERY_KEYS.overview(workspaceId, repositoryId),
      });
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'System overview generation could not be started.'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ArchitectureSectionNav repositoryId={repositoryId} section="overview" />
      <PageHeader
        title="System overview"
        description={`Architecture overview of ${repositoryName}, grounded in the dependency map.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/repositories/${repositoryId}`}>Back to repository</Link>
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">
        This document is grounded in the dependency map for one indexing revision. The onboarding
        executive summary and project overview are separate guides.
      </p>

      {overview.rebuildInProgress ? (
        <p className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          A newer indexing run is in progress. This overview stays on the revision it describes.
        </p>
      ) : null}

      {progress ? (
        <p className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          {progress}
        </p>
      ) : null}

      {document?.stale ? (
        <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          <p>
            This overview describes indexing revision{' '}
            {document.revision.commitSha ?? document.revision.indexingRunId}
            {document.revision.branch ? ` on ${document.revision.branch}` : ''}. A newer revision is
            available.
          </p>
          {canGenerate && overview.generationAllowed ? (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              disabled={pending || Boolean(progress)}
              onClick={() => void requestGeneration(true)}
            >
              {pending ? 'Requesting…' : 'Regenerate'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {availability ? (
        <EmptyState
          title={availability.title}
          description={availability.description}
          action={
            canGenerate && overview.generationAllowed ? (
              <Button disabled={pending} onClick={() => void requestGeneration(false)}>
                {pending ? 'Requesting…' : 'Generate overview'}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {document ? (
        <Card>
          <CardHeader>
            <CardTitle>{document.title}</CardTitle>
            <CardDescription>
              Revision {document.revision.commitSha ?? document.revision.indexingRunId}
              {document.revision.branch ? ` on ${document.revision.branch}` : ''}
              {' · '}
              generated {new Date(document.generatedAt).toLocaleString()}
              {document.modulesAbsent ? ' · not dependency-grounded' : ''}
              {document.partial ? ' · partial dependency graph' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuideMarkdown
              markdown={linkCitedPaths(document.markdown, repositoryId, document.citedPaths)}
            />
          </CardContent>
        </Card>
      ) : null}

      {overview.run?.status === 'FAILED' && overview.run.error ? (
        <ErrorState
          title="Overview generation failed"
          description={overview.run.error}
          action={
            canGenerate && overview.generationAllowed ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void requestGeneration(Boolean(document))}
              >
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {error ? (
        <ErrorState
          title="Overview generation could not start"
          description={error}
          action={
            <Button variant="outline" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        />
      ) : null}

      {document && canGenerate && overview.generationAllowed && !document.stale && !progress ? (
        <Button variant="outline" disabled={pending} onClick={() => void requestGeneration(true)}>
          {pending ? 'Requesting…' : 'Regenerate'}
        </Button>
      ) : null}
    </div>
  );
}
