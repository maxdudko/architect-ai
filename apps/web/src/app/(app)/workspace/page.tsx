import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/shared/components';

const sections = [
  {
    href: '/workspace/settings',
    title: 'Workspace Settings',
    description: 'Update workspace name and plan.',
  },
  {
    href: '/workspace/members',
    title: 'Members',
    description: 'Review current members and roles.',
  },
  {
    href: '/workspace/invitations',
    title: 'Invitations',
    description: 'Invite teammates to join your workspace.',
  },
];

export default function WorkspaceDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Workspace" description="Manage your active workspace operations." />
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.href}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{section.title}</CardTitle>
                <Badge variant="outline">Phase 1</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <Button asChild variant="outline" size="sm">
                <Link href={section.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
