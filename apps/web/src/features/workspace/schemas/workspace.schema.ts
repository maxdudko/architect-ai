import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name is too short').max(120),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name is too short').max(120),
});

export const createInvitationSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

export const upsertWorkspaceAiSettingsSchema = z.object({
  openaiApiKey: z.string().trim().min(8, 'Enter a valid OpenAI API key'),
});
