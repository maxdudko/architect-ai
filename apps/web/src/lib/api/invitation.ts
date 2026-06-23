import type { Invitation, WorkspaceRole } from '@/entities';
import { apiClient } from './axios';

export interface CreateInvitationPayload {
  email: string;
  role: WorkspaceRole;
}

export interface AcceptInvitationPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export async function createInvitation(
  workspaceId: string,
  payload: CreateInvitationPayload,
): Promise<Invitation> {
  const { data } = await apiClient.post<Invitation>(
    `/workspaces/${workspaceId}/invitations`,
    payload,
  );
  return data;
}

export async function acceptInvitation(
  token: string,
  payload: AcceptInvitationPayload,
): Promise<{ workspaceId: string; userId: string }> {
  const { data } = await apiClient.post<{ workspaceId: string; userId: string }>(
    `/invitations/${token}/accept`,
    payload,
  );
  return data;
}
