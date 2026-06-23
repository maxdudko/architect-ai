import { z } from 'zod';

export const repositoryPlaceholderSchema = z.object({
  status: z.literal('coming-soon'),
});
