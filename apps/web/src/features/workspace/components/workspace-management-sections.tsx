'use client';

import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/components';
import { canManageInvitations } from '../utils/workspace-permissions';

const sections = [
  {
    href: '/workspace/settings',
    title: 'Workspace Settings',
    description: 'Update workspace name, review usage, and connect an AI key.',
    invitationAccessOnly: false,
  },
  {
    href: '/workspace/members',
    title: 'Members',
    description: 'Review current members and roles.',
    invitationAccessOnly: false,
  },
  {
    href: '/workspace/invitations',
    title: 'Invitations',
    description: 'Invite teammates to join your workspace.',
    invitationAccessOnly: true,
  },
] as const;

export function WorkspaceManagementSections({ buttonSize = 'sm' }: { buttonSize?: 'sm' | 'lg' }) {
  const { activeWorkspace } = useAuth();
  const canManage = canManageInvitations(activeWorkspace?.role);

  const visibleSections = sections.filter((section) => !section.invitationAccessOnly || canManage);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {visibleSections.map((section) => (
        <Card key={section.href}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
              <Badge variant="outline">Phase 1</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{section.description}</p>
            <Button asChild variant="outline" size={buttonSize}>
              <Link href={section.href}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
