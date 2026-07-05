'use client';

import { Loader } from '@/shared/components';
import { Button, Input, PasswordInput } from '@/shared/components';
import { useSignInForm } from '../hooks/use-sign-in-form';

export function SignInForm() {
  const { form, onSubmit } = useSignInForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
        Sign in
      </Button>
    </form>
  );
}
