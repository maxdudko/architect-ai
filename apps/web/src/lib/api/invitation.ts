import type { Invitation, InvitationPreview } from '@/entities';
import type { AuthResponse } from './types';
import { apiClient } from './axios';

export interface CreateInvitationPayload {
  email: string;
  role: Invitation['role'];
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

export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const { data } = await apiClient.get<InvitationPreview>(`/invitations/${token}`);
  return data;
}

export async function acceptInvitation(
  token: string,
  payload: AcceptInvitationPayload = {},
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    `/invitations/${token}/accept`,
    payload,
  );
  return data;
}
