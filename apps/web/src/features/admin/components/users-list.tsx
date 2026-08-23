'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AdminListedUser } from '@/entities';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  SearchInput,
  Skeleton,
} from '@/shared/components';
import {
  useAdminUsersQuery,
  useBanAdminUserMutation,
  useUnbanAdminUserMutation,
  useUpdateAdminUserMutation,
} from '../services/admin-users.service';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function EditUserDialog({ user }: { user: AdminListedUser }) {
  const updateMutation = useUpdateAdminUserMutation();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [emailVerified, setEmailVerified] = useState(user.emailVerified);

  const resetForm = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setEmailVerified(user.emailVerified);
  };

  const onSave = async () => {
    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        payload: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          emailVerified,
        },
      });
      toast.success('User updated.');
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update user.'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          resetForm();
        }
      }}
    >
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile details for {user.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="space-y-1 block text-sm">
            <span className="font-medium">First name</span>
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={updateMutation.isPending}
            />
          </label>
          <label className="space-y-1 block text-sm">
            <span className="font-medium">Last name</span>
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={updateMutation.isPending}
            />
          </label>
          <label className="space-y-1 block text-sm">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={updateMutation.isPending}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={emailVerified}
              onChange={(event) => setEmailVerified(event.target.checked)}
              disabled={updateMutation.isPending}
            />
            <span>Email verified</span>
          </label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              updateMutation.isPending ||
              firstName.trim() === '' ||
              lastName.trim() === '' ||
              email.trim() === ''
            }
            onClick={() => void onSave()}
          >
            {updateMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ user }: { user: AdminListedUser }) {
  const banMutation = useBanAdminUserMutation();
  const unbanMutation = useUnbanAdminUserMutation();
  const isBanned = Boolean(user.deletedAt);
  const actionPending = banMutation.isPending || unbanMutation.isPending;

  const onBan = async () => {
    try {
      await banMutation.mutateAsync(user.id);
      toast.success('User banned.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to ban user.'));
    }
  };

  const onUnban = async () => {
    try {
      await unbanMutation.mutateAsync(user.id);
      toast.success('User unbanned.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to unban user.'));
    }
  };

  return (
    <div className="grid gap-3 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Created {formatDate(user.createdAt)}</p>
        <p>Last login {formatDate(user.lastLoginAt)}</p>
        {isBanned ? <p>Banned {formatDate(user.deletedAt)}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
          {user.emailVerified ? 'Verified' : 'Unverified'}
        </Badge>
        {isBanned ? <Badge variant="outline">Banned</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <EditUserDialog user={user} />
        {isBanned ? (
          <ConfirmationDialog
            title="Unban user"
            description={`Restore access for ${user.email}? They will be able to sign in again.`}
            confirmText="Unban"
            onConfirm={onUnban}
            trigger={
              <Button type="button" size="sm" variant="outline" disabled={actionPending}>
                Unban
              </Button>
            }
          />
        ) : (
          <ConfirmationDialog
            title="Ban user"
            description={`Ban ${user.email}? They will be signed out and unable to sign in.`}
            confirmText="Ban"
            destructive
            onConfirm={onBan}
            trigger={
              <Button type="button" size="sm" variant="destructive" disabled={actionPending}>
                Ban
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export function UsersList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showBanned, setShowBanned] = useState(true);
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
    includeDeleted: showBanned,
  });

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = usersQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Users</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showBanned}
                onChange={(event) => {
                  setShowBanned(event.target.checked);
                  setPage(1);
                }}
              />
              Show banned
            </label>
            <SearchInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
            />
          </div>
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
