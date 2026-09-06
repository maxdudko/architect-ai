'use client';

import { Loader } from '@/shared/components';
import { Button, PasswordInput } from '@/shared/components';
import { useResetPasswordForm } from '../hooks/use-reset-password-form';

export function ResetPasswordForm({ token }: { token: string }) {
  const { form, onSubmit } = useResetPasswordForm(token);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
        Update password
      </Button>
    </form>
  );
}
