import { UsersList } from '@/features/admin';
import { Button, Card, CardContent, PageHeader } from '@/shared/components';
import Link from 'next/link';

export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader title="Users" description="Manage registered platform users." />
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            User&#39;s workspaces are reviewed on the Workspace usage table.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/usage">Manage workspaces</Link>
          </Button>
        </CardContent>
      </Card>
      <UsersList />
    </div>
  );
}
