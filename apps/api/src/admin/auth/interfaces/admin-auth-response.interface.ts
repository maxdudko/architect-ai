export interface AdminAuthResponse {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    lastLoginAt: Date | null;
  };
}

export type PublicAdminAuthResponse = Omit<AdminAuthResponse, 'refreshToken'>;
export type PublicAdminTokenPair = { accessToken: string };

export function toPublicAdminAuthResponse(
  response: AdminAuthResponse,
): PublicAdminAuthResponse {
  return {
    accessToken: response.accessToken,
    admin: response.admin,
  };
}

export function toPublicAdminTokenPair(tokens: {
  accessToken: string;
}): PublicAdminTokenPair {
  return {
    accessToken: tokens.accessToken,
  };
}
