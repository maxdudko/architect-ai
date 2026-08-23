'use client';

import { useEffect, useState } from 'react';
import type { AdminListedLog, AdminSystemLogCategory, AdminSystemLogLevel } from '@/entities';
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
import { useAdminLogsQuery } from '../services/admin-logs.service';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function truncateId(value: string | null): string {
  if (!value) {
    return '—';
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 8)}…`;
}

function levelVariant(level: AdminSystemLogLevel): 'default' | 'secondary' | 'outline' {
  if (level === 'ERROR') {
    return 'outline';
  }
  if (level === 'WARN') {
    return 'secondary';
  }
  return 'default';
}

function LogRow({ log }: { log: AdminListedLog }) {
  const routeLine =
    log.method && log.route ? `${log.method} ${log.route}` : (log.message ?? log.event);

  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] lg:items-start lg:gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{log.category}</Badge>
          <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
          <span className="font-medium">{log.event}</span>
        </div>
        <p className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</p>
      </div>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="truncate">{routeLine}</p>
        <p className="text-muted-foreground">
          req {truncateId(log.requestId)}
          {log.statusCode != null ? ` · ${log.statusCode}` : ''}
          {log.latencyMs != null ? ` · ${log.latencyMs}ms` : ''}
          {log.actorType ? ` · ${log.actorType}` : ''}
          {log.actorId ? ` ${truncateId(log.actorId)}` : ''}
        </p>
      </div>
      <div className="text-xs text-muted-foreground lg:text-right">
        {log.message && log.method ? <p className="absolute truncate max-w-xs border px-2 rounded">{log.message}</p> : null}
      </div>
    </div>
  );
}

export function LogsList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AdminSystemLogCategory | ''>('');
  const [level, setLevel] = useState<AdminSystemLogLevel | ''>('');
  const [hideOptions, setHideOptions] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const logsQuery = useAdminLogsQuery({
    page,
    pageSize,
    search: search || undefined,
    category: category || undefined,
    level: level || undefined,
    excludeOptions: hideOptions,
  });

  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = logsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Logs</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search event, route, request id"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as AdminSystemLogCategory | '');
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              <option value="HTTP">HTTP</option>
              <option value="AUDIT">AUDIT</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={level}
              onChange={(event) => {
                setLevel(event.target.value as AdminSystemLogLevel | '');
                setPage(1);
              }}
              aria-label="Filter by level"
            >
              <option value="">All levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
            <label className="flex h-9 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={hideOptions}
                onChange={(event) => {
                  setHideOptions(event.target.checked);
                  setPage(1);
                }}
              />
              Hide OPTIONS
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {logsQuery.isError ? (
          <ErrorState
            title="Unable to load logs"
            description="Something went wrong while fetching system logs."
            action={
              <Button type="button" variant="outline" onClick={() => void logsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!logsQuery.isLoading && !logsQuery.isError && items.length === 0 ? (
          <EmptyState
            title="No logs found"
            description={
              search || category || level || hideOptions
                ? 'Try adjusting search or filters.'
                : 'HTTP and audit events will appear here as they are recorded.'
            }
          />
        ) : null}

        {!logsQuery.isLoading && !logsQuery.isError && items.length > 0 ? (
          <div>
            {items.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
