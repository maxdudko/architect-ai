'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { updateWorkspaceSchema } from '../schemas/workspace.schema';
import { useUpdateWorkspaceMutation } from '../services/workspace.service';
import type { UpdateWorkspaceValues } from '../types/workspace.types';

export function useWorkspaceSettingsForm(
  defaultValues: UpdateWorkspaceValues,
  workspaceId: string,
) {
  const mutation = useUpdateWorkspaceMutation(workspaceId);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<UpdateWorkspaceValues>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await mutation.mutateAsync(values);
      setSuccessMessage('Workspace settings updated.');
    } catch {
      setErrorMessage('Unable to update workspace settings.');
    }
  });

  return { form, onSubmit, isSubmitting: mutation.isPending, successMessage, errorMessage };
}
