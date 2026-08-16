'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Loader } from '@/shared/components';
import { useWorkspaceSettingsForm } from '../hooks/use-workspace-settings-form';

interface WorkspaceSettingsFormProps {
  workspaceId: string;
  initialName: string;
  planLabel: string;
}

export function WorkspaceSettingsForm({
  workspaceId,
  initialName,
  planLabel,
}: WorkspaceSettingsFormProps) {
  const { form, onSubmit, isSubmitting, errorMessage, successMessage } = useWorkspaceSettingsForm(
    { name: initialName },
    workspaceId,
  );
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Workspace name
            </label>
            <Input id="name" {...register('name')} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Plan</p>
            <p className="text-sm text-muted-foreground">{planLabel}</p>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
