'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/shared/components';
import { Loader } from '@/shared/components';
import { useCreateWorkspaceForm } from '../hooks/use-create-workspace-form';

export function CreateWorkspaceForm() {
  const { form, onSubmit, isSubmitting, errorMessage, successMessage } = useCreateWorkspaceForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Workspace name
            </label>
            <Input id="workspace-name" placeholder="Platform Team" {...register('name')} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="workspace-plan" className="text-sm font-medium">
              Plan
            </label>
            <select
              id="workspace-plan"
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
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
            Create
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
