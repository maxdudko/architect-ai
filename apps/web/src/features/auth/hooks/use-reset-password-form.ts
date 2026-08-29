'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { resetPassword } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuth } from '@/providers/auth-provider';
import { resetPasswordSchema } from '../schemas/auth.schema';
import type { ResetPasswordFormValues } from '../types/auth-form.types';

export function useResetPasswordForm(token: string) {
  const { logout } = useAuth();
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword({ token, password: values.password });
      toast.success('Password updated. Sign in with your new password.');
      await logout();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'This reset link is invalid or has expired.'),
      );
    }
  });

  return { form, onSubmit };
}
