'use client';

import type { WorkspacePlan } from '@/entities';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Loader,
} from '@/shared/components';
import { useWorkspaceSettingsForm } from '../hooks/use-workspace-settings-form';

interface WorkspaceSettingsFormProps {
  workspaceId: string;
  initialName: string;
  initialPlan: WorkspacePlan;
}

export function WorkspaceSettingsForm({
  workspaceId,
  initialName,
  initialPlan,
}: WorkspaceSettingsFormProps) {
  const { form, onSubmit, isSubmitting, errorMessage, successMessage } = useWorkspaceSettingsForm(
    {
      name: initialName,
      plan: initialPlan,
    },
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
          <div className="space-y-2">
            <label htmlFor="plan" className="text-sm font-medium">
              Plan
            </label>
            <select
              id="plan"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('plan')}
            >
              <option value="FREE">Free</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
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
