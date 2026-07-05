'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuthService } from '../services/auth.service';
import { signInSchema } from '../schemas/auth.schema';
import type { SignInFormValues } from '../types/auth-form.types';

export function useSignInForm() {
  const auth = useAuthService();

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await auth.signIn(values);
    } catch {
      toast.error('Unable to sign in. Please check your credentials.');
    }
  });

  return { form, onSubmit };
}
