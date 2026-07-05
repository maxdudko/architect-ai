'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuthService } from '../services/auth.service';
import { signUpSchema } from '../schemas/auth.schema';
import type { SignUpFormValues } from '../types/auth-form.types';

function getSignUpErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }
  }
  return 'Unable to create your account. Please try again.';
}

export function useSignUpForm() {
  const auth = useAuthService();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await auth.signUp(values);
    } catch (error) {
      toast.error(getSignUpErrorMessage(error));
    }
  });

  return { form, onSubmit };
}
