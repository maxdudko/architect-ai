import { z } from 'zod';

export const createConversationSchema = z.object({
  repositoryId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export type CreateConversationFormValues = z.infer<typeof createConversationSchema>;
export type ChatMessageFormValues = z.infer<typeof chatMessageSchema>;
