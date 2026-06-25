'use client';

import { Mail } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Loader,
  Skeleton,
} from '@/shared/components';
import { useInvitationsQuery, useResendInvitationMutation } from '../services/workspace.service';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

export function InvitationsList({ workspaceId }: { workspaceId: string }) {
  const invitationsQuery = useInvitationsQuery(workspaceId);
  const resendMutation = useResendInvitationMutation(workspaceId);

  if (invitationsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  const invitations = invitationsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          invitations.map((invitation) => {
            const expired = isExpired(invitation.expiresAt);
            const isResending =
              resendMutation.isPending && resendMutation.variables === invitation.id;

            return (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDate(invitation.createdAt)} · Expires{' '}
                    {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {expired ? <Badge variant="outline">Expired</Badge> : null}
                  <Badge>{invitation.role}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isResending}
                    onClick={() => void resendMutation.mutateAsync(invitation.id)}
                  >
                    {isResending ? (
                      <Loader className="mr-2 h-4 w-4" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Resend
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
