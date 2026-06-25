'use client';

import { Loader } from '@/shared/components';
import { Button, Input, PasswordInput } from '@/shared/components';
import { useSignUpForm } from '../hooks/use-sign-up-form';

export function SignUpForm() {
  const { form, onSubmit, errorMessage, successMessage } = useSignUpForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
          {errors.firstName ? (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
          {errors.lastName ? (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>
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
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
        Create account
      </Button>
    </form>
  );
}
