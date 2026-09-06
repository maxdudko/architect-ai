'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createInvitationSchema } from '../schemas/workspace.schema';
import { useCreateInvitationMutation } from '../services/workspace.service';
import type { CreateInvitationValues } from '../types/workspace.types';
import { getApiErrorMessage } from '@/lib/api/error-message';

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
      if (invitation.emailSent === false) {
        setErrorMessage(
          'Failed to send invitation email. Please copy the invitation link from Pending Invitations and send it manually.',
        );
      } else {
        setSuccessMessage(`Invitation sent to ${invitation.email}.`);
      }
      form.reset();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Failed to create invitation.'));
    }
  });

  return { form, onSubmit, isSubmitting: mutation.isPending, successMessage, errorMessage };
}
