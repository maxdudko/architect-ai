export interface AdminJwtPayload {
  sub: string;
  email: string;
  tokenType: 'admin';
}
