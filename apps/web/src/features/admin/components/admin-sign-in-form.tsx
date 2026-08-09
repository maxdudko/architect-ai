'use client';

import { Button, Input, Loader, PasswordInput } from '@/shared/components';
import { useAdminSignInForm } from '../hooks/use-admin-sign-in-form';

export function AdminSignInForm() {
  const { form, onSubmit } = useAdminSignInForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="admin-email" className="text-sm font-medium">
          Email
        </label>
        <Input id="admin-email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          {...register('password')}
        />
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
