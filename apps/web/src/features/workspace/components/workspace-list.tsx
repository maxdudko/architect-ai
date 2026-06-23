'use client';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components';
import { useWorkspacesQuery } from '../services/workspace.service';

export function WorkspaceList() {
  const query = useWorkspacesQuery();

  if (!query.data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No workspaces yet</CardTitle>
          <CardDescription>Create a workspace to start organizing your team.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.data.map((workspace) => (
          <div
            key={workspace.id}
            className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
          >
            <div>
              <p className="font-medium">{workspace.name}</p>
              <p className="text-xs text-muted-foreground">{workspace.slug}</p>
            </div>
            <Badge>{workspace.role}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
