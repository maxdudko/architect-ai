'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthService } from '../services/auth.service';
import { signInSchema } from '../schemas/auth.schema';
import type { SignInFormValues } from '../types/auth-form.types';

export function useSignInForm() {
  const auth = useAuthService();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await auth.signIn(values);
      setSuccessMessage('Signed in successfully.');
    } catch {
      setErrorMessage('Unable to sign in. Please check your credentials.');
    }
  });

  return { form, onSubmit, successMessage, errorMessage };
}
