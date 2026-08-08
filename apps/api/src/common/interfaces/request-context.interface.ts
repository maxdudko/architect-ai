import type { WorkspaceRole } from '@prisma/client';

export interface RequestWorkspaceContext {
  id?: string;
  role?: WorkspaceRole;
}

export interface RequestContextCarrier {
  user?: { sub?: string; activeWorkspaceId?: string };
  workspace?: RequestWorkspaceContext;
  params?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  path?: string;
  requestId?: string;
}
