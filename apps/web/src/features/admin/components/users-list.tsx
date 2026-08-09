'use client';

import { useEffect, useState } from 'react';
import type { AdminListedUser } from '@/entities';
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
import { useAdminUsersQuery } from '../services/admin-users.service';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function UserRow({ user }: { user: AdminListedUser }) {
  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Created {formatDate(user.createdAt)}</p>
        <p>Last login {formatDate(user.lastLoginAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
          {user.emailVerified ? 'Verified' : 'Unverified'}
        </Badge>
        {user.deletedAt ? <Badge variant="outline">Deleted</Badge> : null}
      </div>
      <div className="text-xs text-muted-foreground md:text-right">
        {user.deletedAt ? `Deleted ${formatDate(user.deletedAt)}` : null}
      </div>
    </div>
  );
}

export function UsersList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const usersQuery = useAdminUsersQuery({
    page,
    pageSize,
    search: search || undefined,
  });

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = usersQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Users</CardTitle>
          <SearchInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email"
          />
        </div>
      </CardHeader>
      <CardContent>
        {usersQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {usersQuery.isError ? (
          <ErrorState
            title="Unable to load users"
            description="Something went wrong while fetching the users list."
            action={
              <Button type="button" variant="outline" onClick={() => void usersQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!usersQuery.isLoading && !usersQuery.isError && items.length === 0 ? (
          <EmptyState
            title="No users found"
            description={
              search
                ? 'Try a different search term.'
                : 'Registered platform users will appear here.'
            }
          />
        ) : null}

        {!usersQuery.isLoading && !usersQuery.isError && items.length > 0 ? (
          <div>
            {items.map((user) => (
              <UserRow key={user.id} user={user} />
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
