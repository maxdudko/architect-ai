'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthService } from '../services/auth.service';
import { signUpSchema } from '../schemas/auth.schema';
import type { SignUpFormValues } from '../types/auth-form.types';

export function useSignUpForm() {
  const auth = useAuthService();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await auth.signUp(values);
      setSuccessMessage('Account created successfully.');
    } catch {
      setErrorMessage('Unable to create your account. Please try again.');
    }
  });

  return { form, onSubmit, successMessage, errorMessage };
}
