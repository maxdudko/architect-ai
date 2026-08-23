import type { OauthProviderName } from '../oauth-provider';

export interface OauthProfile {
  provider: OauthProviderName;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}
