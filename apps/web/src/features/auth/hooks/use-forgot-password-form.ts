'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { requestPasswordReset } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { forgotPasswordSchema } from '../schemas/auth.schema';
import type { ForgotPasswordFormValues } from '../types/auth-form.types';

export function useForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestPasswordReset(values.email);
      setIsSubmitted(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send a reset email. Please try again.'));
    }
  });

  return { form, onSubmit, isSubmitted };
}
