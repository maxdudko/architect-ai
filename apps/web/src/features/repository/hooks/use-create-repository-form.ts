'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createRepositorySchema } from '../schemas/repository.schema';

type CreateRepositoryFormValues = z.infer<typeof createRepositorySchema>;

export function useCreateRepositoryForm() {
  return useForm<CreateRepositoryFormValues>({
    resolver: zodResolver(createRepositorySchema),
    defaultValues: {
      provider: 'GITHUB',
      externalId: '',
      owner: '',
      name: '',
      fullName: '',
      defaultBranch: 'main',
    },
  });
}
