import { z } from 'zod';

export const settingsPlaceholderSchema = z.object({
  status: z.literal('coming-soon'),
});
