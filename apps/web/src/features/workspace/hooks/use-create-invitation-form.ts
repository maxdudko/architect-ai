'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createInvitationSchema } from '../schemas/workspace.schema';
import { useCreateInvitationMutation } from '../services/workspace.service';
import type { CreateInvitationValues } from '../types/workspace.types';

export function useCreateInvitationForm(workspaceId: string) {
  const mutation = useCreateInvitationMutation(workspaceId);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<CreateInvitationValues>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const invitation = await mutation.mutateAsync(values);
      setSuccessMessage(`Invitation sent to ${invitation.email}.`);
      form.reset();
    } catch {
      setErrorMessage('Failed to create invitation.');
    }
  });

  return { form, onSubmit, isSubmitting: mutation.isPending, successMessage, errorMessage };
}
