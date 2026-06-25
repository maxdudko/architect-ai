'use client';

import { Trash2 } from 'lucide-react';
import type { Membership, WorkspaceRole } from '@/entities';
import { useAuth } from '@/providers/auth-provider';
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
import {
  useMembersQuery,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from '../services/workspace.service';

const ALL_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const ADMIN_ASSIGNABLE_ROLES: WorkspaceRole[] = ['MEMBER', 'VIEWER'];

function canManageMembers(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function getAssignableRoles(actorRole: WorkspaceRole | undefined): WorkspaceRole[] {
  if (actorRole === 'OWNER') {
    return ALL_ROLES;
  }
  if (actorRole === 'ADMIN') {
    return ADMIN_ASSIGNABLE_ROLES;
  }
  return [];
}

function canEditMemberRole(
  member: Membership,
  actorRole: WorkspaceRole | undefined,
  currentUserId: string | undefined,
): boolean {
  if (!canManageMembers(actorRole) || !currentUserId) {
    return false;
  }
  if (member.user.id === currentUserId) {
    return false;
  }
  if (member.role === 'OWNER') {
    return false;
  }
  if (actorRole === 'ADMIN' && member.role === 'ADMIN') {
    return false;
  }
  return true;
}

export function MembersList({ workspaceId }: { workspaceId: string }) {
  const { user, activeWorkspace } = useAuth();
  const membersQuery = useMembersQuery(workspaceId);
  const removeMemberMutation = useRemoveMemberMutation(workspaceId);
  const updateRoleMutation = useUpdateMemberRoleMutation(workspaceId);

  const assignableRoles = getAssignableRoles(activeWorkspace?.role);
  const showRemoveAction = canManageMembers(activeWorkspace?.role);

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
        {(membersQuery.data ?? []).map((member) => {
          const editable = canEditMemberRole(member, activeWorkspace?.role, user?.id);
          const isUpdating =
            updateRoleMutation.isPending && updateRoleMutation.variables?.memberId === member.id;

          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.user.firstName} {member.user.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editable ? (
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={member.role}
                    disabled={isUpdating}
                    onChange={(event) => {
                      const role = event.target.value as WorkspaceRole;
                      if (role === member.role) {
                        return;
                      }
                      void updateRoleMutation.mutateAsync({ memberId: member.id, role });
                    }}
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge>{member.role}</Badge>
                )}
                {showRemoveAction && member.role !== 'OWNER' && member.user.id !== user?.id ? (
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
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
