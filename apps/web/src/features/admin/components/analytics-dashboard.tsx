'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type {
  AdminActiveUsageDay,
  AdminFeedbackRow,
  AdminQuestionRow,
  AdminRepositoryEvent,
  AdminSourceRow,
  AdminTokenUsageRow,
} from '@/entities';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SearchInput,
  Skeleton,
} from '@/shared/components';
import {
  useAdminActiveUsageQuery,
  useAdminAnalyticsOverviewQuery,
  useAdminFeedbackQuery,
  useAdminQuestionsQuery,
  useAdminRepositoryEventsQuery,
  useAdminSourcesQuery,
  useAdminTokenUsageQuery,
} from '../services/admin-analytics.service';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPercent(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(Math.round(value));
}

function useDebouncedSearch(pageSize = 10) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  return {
    searchInput,
    setSearchInput,
    search,
    page,
    setPage,
    pageSize,
  };
}

function PaginationControls({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  searchInput,
  onSearchChange,
  searchPlaceholder,
  isLoading,
  isError,
  onRetry,
  children,
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  title: string;
  searchInput?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  children: ReactNode;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{title}</CardTitle>
          {onSearchChange && searchInput !== undefined ? (
            <SearchInput
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : null}
        {isError ? (
          <ErrorState
            title={`Unable to load ${title.toLowerCase()}`}
            description="Something went wrong while fetching analytics data."
            action={
              <Button type="button" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : null}
        {!isLoading && !isError ? children : null}
        {!isLoading && !isError ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const overviewQuery = useAdminAnalyticsOverviewQuery();
  const eventsState = useDebouncedSearch();
  const questionsState = useDebouncedSearch();
  const sourcesState = useDebouncedSearch();
  const feedbackState = useDebouncedSearch();
  const tokenUsageState = useDebouncedSearch();
  const [activeUsagePage, setActiveUsagePage] = useState(1);
  const activeUsagePageSize = 14;

  const eventsQuery = useAdminRepositoryEventsQuery({
    page: eventsState.page,
    pageSize: eventsState.pageSize,
    search: eventsState.search || undefined,
  });
  const questionsQuery = useAdminQuestionsQuery({
    page: questionsState.page,
    pageSize: questionsState.pageSize,
    search: questionsState.search || undefined,
  });
  const sourcesQuery = useAdminSourcesQuery({
    page: sourcesState.page,
    pageSize: sourcesState.pageSize,
    search: sourcesState.search || undefined,
  });
  const feedbackQuery = useAdminFeedbackQuery({
    page: feedbackState.page,
    pageSize: feedbackState.pageSize,
    search: feedbackState.search || undefined,
  });
  const tokenUsageQuery = useAdminTokenUsageQuery({
    page: tokenUsageState.page,
    pageSize: tokenUsageState.pageSize,
    search: tokenUsageState.search || undefined,
  });
  const activeUsageQuery = useAdminActiveUsageQuery({
    page: activeUsagePage,
    pageSize: activeUsagePageSize,
    days: 30,
  });

  const overview = overviewQuery.data;
  const events = eventsQuery.data?.items ?? [];
  const questions = questionsQuery.data?.items ?? [];
  const sources = sourcesQuery.data?.items ?? [];
  const feedback = feedbackQuery.data?.items ?? [];
  const tokenUsage = tokenUsageQuery.data?.items ?? [];
  const activeDays = activeUsageQuery.data?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {overviewQuery.isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : null}
        {overviewQuery.isError ? (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <ErrorState
              title="Unable to load overview"
              description="Something went wrong while fetching analytics KPIs."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void overviewQuery.refetch()}
                >
                  Try again
                </Button>
              }
            />
          </div>
        ) : null}
        {overview ? (
          <>
            <KpiCard label="DAU (UTC)" value={String(overview.activeUsage.dau)} />
            <KpiCard label="WAU (UTC)" value={String(overview.activeUsage.wau)} />
            <KpiCard
              label="Stickiness (DAU/WAU)"
              value={formatPercent(overview.activeUsage.stickiness)}
            />
            <KpiCard label="Repo connections" value={String(overview.repositoryConnections)} />
            <KpiCard label="Questions asked" value={String(overview.questionsAsked)} />
            <KpiCard label="Source citations" value={String(overview.sourceCitations)} />
            <KpiCard
              label="Feedback (helpful)"
              value={`${overview.feedback.helpful} / ${overview.feedback.total}`}
            />
            <KpiCard label="Helpful rate" value={formatPercent(overview.feedback.helpfulRate)} />
            <KpiCard
              label="Total tokens"
              value={formatTokenCount(overview.tokenUsage.totalTokens)}
            />
            <KpiCard
              label="Input / output tokens"
              value={`${formatTokenCount(overview.tokenUsage.inputTokens)} / ${formatTokenCount(overview.tokenUsage.outputTokens)}`}
            />
            <KpiCard
              label="Token coverage"
              value={formatPercent(overview.tokenUsage.coverageRate)}
            />
          </>
        ) : null}
      </div>

      <SectionCard
        title="Repository connections"
        searchInput={eventsState.searchInput}
        onSearchChange={eventsState.setSearchInput}
        searchPlaceholder="Search by repo name or id"
        isLoading={eventsQuery.isLoading}
        isError={eventsQuery.isError}
        onRetry={() => void eventsQuery.refetch()}
        page={eventsState.page}
        totalPages={Math.max(1, Math.ceil((eventsQuery.data?.total ?? 0) / eventsState.pageSize))}
        onPrevious={() => eventsState.setPage((page) => Math.max(1, page - 1))}
        onNext={() => eventsState.setPage((page) => page + 1)}
      >
        {events.length === 0 ? (
          <EmptyState
            title="No repository events"
            description={
              eventsState.search
                ? 'Try a different search term.'
                : 'Connection and indexing events will appear here.'
            }
          />
        ) : (
          <div>
            {events.map((event: AdminRepositoryEvent) => (
              <div
                key={event.id}
                className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {event.repositoryFullName ?? event.repositoryId ?? 'Unknown repository'}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {event.workspaceName ?? event.workspaceId}
                    {event.actorEmail ? ` · ${event.actorEmail}` : ''}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">{formatDate(event.createdAt)}</div>
                <Badge variant="secondary">{event.type.replaceAll('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Questions asked"
        searchInput={questionsState.searchInput}
        onSearchChange={questionsState.setSearchInput}
        searchPlaceholder="Search question text"
        isLoading={questionsQuery.isLoading}
        isError={questionsQuery.isError}
        onRetry={() => void questionsQuery.refetch()}
        page={questionsState.page}
        totalPages={Math.max(
          1,
          Math.ceil((questionsQuery.data?.total ?? 0) / questionsState.pageSize),
        )}
        onPrevious={() => questionsState.setPage((page) => Math.max(1, page - 1))}
        onNext={() => questionsState.setPage((page) => page + 1)}
      >
        {questions.length === 0 ? (
          <EmptyState
            title="No questions"
            description={
              questionsState.search
                ? 'Try a different search term.'
                : 'User questions will appear here.'
            }
          />
        ) : (
          <div>
            {questions.map((question: AdminQuestionRow) => (
              <div key={question.id} className="space-y-1 border-b py-3 last:border-b-0">
                <p className="text-sm">{question.content}</p>
                <p className="text-xs text-muted-foreground">
                  {question.workspaceName} · {question.userEmail}
                  {question.repositoryFullName ? ` · ${question.repositoryFullName}` : ''} ·{' '}
                  {formatDate(question.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Source usage"
        searchInput={sourcesState.searchInput}
        onSearchChange={sourcesState.setSearchInput}
        searchPlaceholder="Search file path"
        isLoading={sourcesQuery.isLoading}
        isError={sourcesQuery.isError}
        onRetry={() => void sourcesQuery.refetch()}
        page={sourcesState.page}
        totalPages={Math.max(1, Math.ceil((sourcesQuery.data?.total ?? 0) / sourcesState.pageSize))}
        onPrevious={() => sourcesState.setPage((page) => Math.max(1, page - 1))}
        onNext={() => sourcesState.setPage((page) => page + 1)}
      >
        {sources.length === 0 ? (
          <EmptyState
            title="No citations"
            description={
              sourcesState.search
                ? 'Try a different search term.'
                : 'Cited source files will appear here.'
            }
          />
        ) : (
          <div>
            {sources.map((source: AdminSourceRow) => (
              <div
                key={`${source.repositoryId}-${source.filePath}-${source.workspaceId}`}
                className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_auto_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{source.filePath}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {source.repositoryFullName ?? source.repositoryId} ·{' '}
                    {source.workspaceName ?? source.workspaceId}
                  </p>
                </div>
                <Badge variant="outline">{source.citationCount} citations</Badge>
                <p className="text-xs text-muted-foreground md:text-right">
                  avg score{' '}
                  {source.averageScore == null ? '—' : source.averageScore.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Answer feedback"
        searchInput={feedbackState.searchInput}
        onSearchChange={feedbackState.setSearchInput}
        searchPlaceholder="Search by email or answer text"
        isLoading={feedbackQuery.isLoading}
        isError={feedbackQuery.isError}
        onRetry={() => void feedbackQuery.refetch()}
        page={feedbackState.page}
        totalPages={Math.max(
          1,
          Math.ceil((feedbackQuery.data?.total ?? 0) / feedbackState.pageSize),
        )}
        onPrevious={() => feedbackState.setPage((page) => Math.max(1, page - 1))}
        onNext={() => feedbackState.setPage((page) => page + 1)}
      >
        {feedback.length === 0 ? (
          <EmptyState
            title="No feedback"
            description={
              feedbackState.search
                ? 'Try a different search term.'
                : 'Helpful / Not Helpful ratings will appear here.'
            }
          />
        ) : (
          <div>
            {feedback.map((item: AdminFeedbackRow) => (
              <div
                key={item.id}
                className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_auto_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm">{item.messageSnippet}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.userEmail} · {item.workspaceName ?? item.workspaceId} ·{' '}
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <Badge variant={item.rating === 'HELPFUL' ? 'default' : 'outline'}>
                  {item.rating === 'HELPFUL' ? 'Helpful' : 'Not Helpful'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Token usage (cost proxy)"
        searchInput={tokenUsageState.searchInput}
        onSearchChange={tokenUsageState.setSearchInput}
        searchPlaceholder="Search workspace name or slug"
        isLoading={tokenUsageQuery.isLoading}
        isError={tokenUsageQuery.isError}
        onRetry={() => void tokenUsageQuery.refetch()}
        page={tokenUsageState.page}
        totalPages={Math.max(
          1,
          Math.ceil((tokenUsageQuery.data?.total ?? 0) / tokenUsageState.pageSize),
        )}
        onPrevious={() => tokenUsageState.setPage((page) => Math.max(1, page - 1))}
        onNext={() => tokenUsageState.setPage((page) => page + 1)}
      >
        {tokenUsage.length === 0 ? (
          <EmptyState
            title="No token usage"
            description={
              tokenUsageState.search
                ? 'Try a different search term.'
                : 'Token totals from assistant answers will appear here by workspace.'
            }
          />
        ) : (
          <div>
            {tokenUsage.map((row: AdminTokenUsageRow) => (
              <div
                key={row.workspaceId}
                className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_repeat(3,auto)] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {row.workspaceName ?? row.workspaceId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.workspaceSlug ?? row.workspaceId} · {row.answersWithUsage}/
                    {row.answerCount} answers with usage
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  in {formatTokenCount(row.inputTokens)}
                </p>
                <p className="text-sm text-muted-foreground">
                  out {formatTokenCount(row.outputTokens)}
                </p>
                <Badge variant="outline">{formatTokenCount(row.totalTokens)} total</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Active usage (UTC)"
        isLoading={activeUsageQuery.isLoading}
        isError={activeUsageQuery.isError}
        onRetry={() => void activeUsageQuery.refetch()}
        page={activeUsagePage}
        totalPages={Math.max(
          1,
          Math.ceil((activeUsageQuery.data?.total ?? 0) / activeUsagePageSize),
        )}
        onPrevious={() => setActiveUsagePage((page) => Math.max(1, page - 1))}
        onNext={() => setActiveUsagePage((page) => page + 1)}
      >
        {activeDays.length === 0 ? (
          <EmptyState
            title="No active usage"
            description="Daily active users (users who asked at least one question) will appear here."
          />
        ) : (
          <div>
            {activeDays.map((row: AdminActiveUsageDay) => (
              <div
                key={row.day}
                className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_auto_auto] md:items-center md:gap-4"
              >
                <p className="font-medium">{formatDay(row.day)}</p>
                <Badge variant="outline">{row.activeUsers} active users</Badge>
                <p className="text-sm text-muted-foreground md:text-right">
                  {row.questions} questions
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
