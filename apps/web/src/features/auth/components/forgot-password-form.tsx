'use client';

import { Loader } from '@/shared/components';
import { Button, Input } from '@/shared/components';
import { useForgotPasswordForm } from '../hooks/use-forgot-password-form';

export function ForgotPasswordForm() {
  const { form, onSubmit, isSubmitted } = useForgotPasswordForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  if (isSubmitted) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists for that email, we sent password reset instructions.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
        Send reset link
      </Button>
    </form>
  );
}
