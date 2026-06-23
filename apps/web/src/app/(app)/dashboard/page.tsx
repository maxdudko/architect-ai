import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '@/shared/components';

const cards = [
  {
    title: 'Repositories',
    description: 'Connected code repositories and indexing status.',
  },
  {
    title: 'Conversations',
    description: 'Recent AI onboarding assistant sessions.',
  },
  {
    title: 'Knowledge Base',
    description: 'Generated architecture and code insights.',
  },
  {
    title: 'Recent Activity',
    description: 'Workspace activity and teammate actions.',
  },
  {
    title: 'Upcoming AI Features',
    description: 'Planned capabilities for repository intelligence.',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Phase 1 control center for onboarding and workspace setup."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{card.title}</CardTitle>
                <Badge variant="outline">Soon</Badge>
              </div>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Placeholder widget for Phase 2 integration.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
