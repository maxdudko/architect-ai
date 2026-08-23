export type OauthErrorCode =
  | 'access_denied'
  | 'account_unavailable'
  | 'email_unavailable'
  | 'invalid_state'
  | 'not_configured'
  | 'provider_conflict'
  | 'provider_error';

export class OauthFlowException extends Error {
  constructor(
    readonly code: OauthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OauthFlowException';
  }
}
