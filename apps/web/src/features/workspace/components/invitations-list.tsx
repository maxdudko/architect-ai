'use client';

import { useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const EMAIL_FAILED_MESSAGE =
  'Failed to send invitation email. Please copy the invitation link and send it manually.';

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

interface InvitationsListProps {
  workspaceId: string;
  className?: string;
}

export function InvitationsList({ workspaceId, className }: InvitationsListProps) {
  const invitationsQuery = useInvitationsQuery(workspaceId);
  const resendMutation = useResendInvitationMutation(workspaceId);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendWarningId, setResendWarningId] = useState<string | null>(null);

  if (invitationsQuery.isLoading) {
    return (
      <Card className={cn('flex flex-1 flex-col', className)}>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  const invitations = invitationsQuery.data ?? [];

  async function copyInviteUrl(invitationId: string, inviteUrl: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(invitationId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === invitationId ? null : current));
      }, 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <Card className={cn('flex flex-1 flex-col', className)}>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
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
                className="space-y-2 rounded-md border border-border/70 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
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
                      onClick={() =>
                        void resendMutation
                          .mutateAsync(invitation.id)
                          .then((result) => {
                            setResendWarningId(result.emailSent === false ? invitation.id : null);
                          })
                          .catch(() => {
                            setResendWarningId(invitation.id);
                          })
                      }
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
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {invitation.inviteUrl}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyInviteUrl(invitation.id, invitation.inviteUrl)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedId === invitation.id ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
                {resendWarningId === invitation.id ? (
                  <p className="text-xs text-destructive">{EMAIL_FAILED_MESSAGE}</p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
