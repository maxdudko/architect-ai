'use client';

import { Trash2 } from 'lucide-react';
import { ConfirmationDialog } from '@/shared/components';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/shared/components';
import { useMembersQuery, useRemoveMemberMutation } from '../services/workspace.service';

export function MembersList({ workspaceId }: { workspaceId: string }) {
  const membersQuery = useMembersQuery(workspaceId);
  const removeMemberMutation = useRemoveMemberMutation(workspaceId);

  if (membersQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(membersQuery.data ?? []).map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {member.user.firstName} {member.user.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{member.role}</Badge>
              <ConfirmationDialog
                title="Remove member"
                description={`Remove ${member.user.email} from this workspace?`}
                destructive
                confirmText="Remove"
                onConfirm={async () => {
                  await removeMemberMutation.mutateAsync(member.id);
                }}
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
