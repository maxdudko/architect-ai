import type { z } from 'zod';
import {
  createInvitationSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from '../schemas/workspace.schema';

export type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceValues = z.infer<typeof updateWorkspaceSchema>;
export type CreateInvitationValues = z.infer<typeof createInvitationSchema>;
