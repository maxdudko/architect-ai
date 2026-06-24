import { z } from 'zod';

export const repositoryProviderSchema = z.enum(['GITHUB', 'GITLAB', 'BITBUCKET']);

export const createRepositorySchema = z.object({
  provider: repositoryProviderSchema,
  externalId: z.string().min(1, 'External ID is required').max(255),
  owner: z.string().min(1, 'Owner is required').max(255),
  name: z.string().min(1, 'Name is required').max(255),
  fullName: z.string().min(1, 'Full name is required').max(512),
  defaultBranch: z
    .string()
    .min(1, 'Default branch is required')
    .max(255)
    .regex(/^[A-Za-z0-9._/-]+$/, 'Branch name contains invalid characters'),
});
