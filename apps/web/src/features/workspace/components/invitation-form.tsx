'use client';

import { cn } from '@/lib/utils';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Loader,
} from '@/shared/components';
import { useCreateInvitationForm } from '../hooks/use-create-invitation-form';

interface InvitationFormProps {
  workspaceId: string;
  className?: string;
}

export function InvitationForm({ workspaceId, className }: InvitationFormProps) {
  const { form, onSubmit, isSubmitting, errorMessage, successMessage } =
    useCreateInvitationForm(workspaceId);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-role" className="text-sm font-medium">
              Role
            </label>
            <select
              id="invite-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('role')}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="VIEWER">Viewer</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
            Send invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
