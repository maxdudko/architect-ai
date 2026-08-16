'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createWorkspaceSchema } from '../schemas/workspace.schema';
import { useCreateWorkspaceMutation } from '../services/workspace.service';
import type { CreateWorkspaceValues } from '../types/workspace.types';

export function useCreateWorkspaceForm() {
  const mutation = useCreateWorkspaceMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await mutation.mutateAsync(values);
      setSuccessMessage('Workspace created successfully.');
      form.reset();
    } catch {
      setErrorMessage('Could not create workspace. Try again.');
    }
  });

  return { form, onSubmit, isSubmitting: mutation.isPending, successMessage, errorMessage };
}
