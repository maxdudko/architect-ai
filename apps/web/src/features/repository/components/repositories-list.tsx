'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/providers/auth-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  Input,
  Skeleton,
} from '@/shared/components';
import { canManageRepositories } from '../utils/repository-permissions';
import { createRepositorySchema } from '../schemas/repository.schema';
import {
  useCreateRepositoryMutation,
  useDeleteRepositoryMutation,
  useRepositoriesQuery,
} from '../services/repository.service';

type CreateRepositoryFormValues = z.infer<typeof createRepositorySchema>;

export function RepositoriesList() {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const query = useRepositoriesQuery(workspaceId);
  const createMutation = useCreateRepositoryMutation(workspaceId);
  const deleteMutation = useDeleteRepositoryMutation(workspaceId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canManage = canManageRepositories(activeWorkspace?.role);

  const form = useForm<CreateRepositoryFormValues>({
    resolver: zodResolver(createRepositorySchema),
    defaultValues: {
      provider: 'GITHUB',
      externalId: '',
      owner: '',
      name: '',
      fullName: '',
      defaultBranch: 'main',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(values);
      form.reset({
        provider: 'GITHUB',
        externalId: '',
        owner: '',
        name: '',
        fullName: '',
        defaultBranch: 'main',
      });
    } catch {
      setErrorMessage('Unable to connect repository. It may already be linked.');
    }
  });

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active workspace</CardTitle>
          <CardDescription>Select a workspace to manage repositories.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect Repository</CardTitle>
            <CardDescription>
              Register a repository for this workspace. GitHub OAuth integration will replace
              manual entry later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
              <Input placeholder="Provider (GITHUB)" {...form.register('provider')} />
              <Input placeholder="External ID" {...form.register('externalId')} />
              <Input placeholder="Owner" {...form.register('owner')} />
              <Input placeholder="Name" {...form.register('name')} />
              <Input placeholder="Full name (owner/name)" {...form.register('fullName')} />
              <Input placeholder="Default branch" {...form.register('defaultBranch')} />
              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  Connect repository
                </Button>
                {errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected Repositories</CardTitle>
          <CardDescription>
            Repositories are scoped to the active workspace ({activeWorkspace?.name}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : null}
          {!query.isLoading && !query.data?.length ? (
            <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
          ) : null}
          {query.data?.map((repository) => (
            <div
              key={repository.id}
              className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
            >
              <div>
                <p className="font-medium">{repository.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {repository.provider} · {repository.defaultBranch}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{repository.status}</Badge>
                {canManage ? (
                  <ConfirmationDialog
                    title="Disconnect repository?"
                    description={`Remove ${repository.fullName} from this workspace.`}
                    confirmText="Disconnect"
                    destructive
                    onConfirm={async () => {
                      await deleteMutation.mutateAsync(repository.id);
                    }}
                    trigger={
                      <Button variant="outline" size="sm" disabled={deleteMutation.isPending}>
                        Disconnect
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
