export interface RefreshTokenPayload {
  sub: string;
  email: string;
  tokenType: 'refresh';
  activeWorkspaceId?: string;
}
