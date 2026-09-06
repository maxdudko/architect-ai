'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuth } from '@/providers/auth-provider';
import { updateProfileSchema } from '../schemas/profile.schema';
import type { UpdateProfileFormValues } from '../types/profile.types';

export function useProfileForm() {
  const { user, updateProfile } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }
    form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }, [form, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateProfile(values);
      setSuccessMessage('Profile updated.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to update your profile.'));
    }
  });

  return {
    form,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    successMessage,
    errorMessage,
  };
}
