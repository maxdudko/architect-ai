export interface AdminRefreshTokenPayload {
  sub: string;
  email: string;
  tokenType: 'admin-refresh';
}
