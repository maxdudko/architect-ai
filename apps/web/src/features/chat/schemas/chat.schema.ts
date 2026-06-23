import { z } from 'zod';

export const chatPlaceholderSchema = z.object({
  status: z.literal('coming-soon'),
});
