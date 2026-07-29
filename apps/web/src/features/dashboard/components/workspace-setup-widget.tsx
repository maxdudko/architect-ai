'use client';

import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/shared/components';
import { useGithubConnectionQuery } from '@/features/repository/services/repository.service';
import {
  useInvitationsQuery,
  useMembersQuery,
} from '@/features/workspace/services/workspace.service';

interface WorkspaceSetupWidgetProps {
  workspaceId: string;
}

export function WorkspaceSetupWidget({ workspaceId }: WorkspaceSetupWidgetProps) {
  const githubQuery = useGithubConnectionQuery();
  const membersQuery = useMembersQuery(workspaceId);
  const invitationsQuery = useInvitationsQuery(workspaceId);

  const failedQueries = [githubQuery, membersQuery, invitationsQuery].filter(
    (query) => query.isError,
  );

  const activeMemberCount =
    membersQuery.data?.filter((member) => member.status === 'ACTIVE').length ?? 0;
  const pendingInvitationCount = invitationsQuery.data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace Setup</CardTitle>
        <CardDescription>Connection, team, and invitation status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">GitHub</span>
          {githubQuery.isLoading ? (
            <Skeleton className="h-6 w-28" />
          ) : githubQuery.isError ? (
            <span className="text-xs text-destructive">Unavailable</span>
          ) : githubQuery.data?.connected ? (
            <Badge variant="outline">
              Connected{githubQuery.data.login ? ` · ${githubQuery.data.login}` : ''}
            </Badge>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/repositories">Connect</Link>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link href="/workspace/members" className="text-sm hover:underline">
            Members
          </Link>
          {membersQuery.isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : membersQuery.isError ? (
            <span className="text-xs text-destructive">Unavailable</span>
          ) : (
            <Badge variant="outline">{activeMemberCount} active</Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link href="/workspace/invitations" className="text-sm hover:underline">
            Pending invites
          </Link>
          {invitationsQuery.isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : invitationsQuery.isError ? (
            <span className="text-xs text-destructive">Unavailable</span>
          ) : (
            <Badge variant="outline">{pendingInvitationCount} pending</Badge>
          )}
        </div>

        {failedQueries.length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-destructive">Some setup data failed to load.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                for (const query of failedQueries) {
                  void query.refetch();
                }
              }}
            >
              Retry
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
