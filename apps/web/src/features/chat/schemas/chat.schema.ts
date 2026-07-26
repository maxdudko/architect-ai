import { z } from 'zod';

export const createConversationSchema = z.object({
  repositoryId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
});

export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a conversation name.')
    .max(200, 'Name must be 200 characters or fewer.'),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export type CreateConversationFormValues = z.infer<typeof createConversationSchema>;
export type UpdateConversationFormValues = z.infer<typeof updateConversationSchema>;
export type ChatMessageFormValues = z.infer<typeof chatMessageSchema>;

export function titleFromMessage(content: string, maxLength = 60): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function isDefaultConversationTitle(title?: string | null): boolean {
  if (!title?.trim()) {
    return true;
  }
  return title.trim().toLowerCase() === 'new conversation';
}
