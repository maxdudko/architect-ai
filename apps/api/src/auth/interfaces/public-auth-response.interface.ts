import { AuthResponse } from './auth-response.interface';
import { TokenPair } from './token-pair.interface';

export type PublicAuthResponse = Omit<AuthResponse, 'refreshToken'>;
export type PublicTokenPair = Omit<TokenPair, 'refreshToken'>;

export function toPublicAuthResponse(
  response: AuthResponse,
): PublicAuthResponse {
  return {
    accessToken: response.accessToken,
    user: response.user,
    workspaces: response.workspaces,
    activeWorkspace: response.activeWorkspace,
  };
}

export function toPublicTokenPair(tokens: TokenPair): PublicTokenPair {
  return {
    accessToken: tokens.accessToken,
  };
}
