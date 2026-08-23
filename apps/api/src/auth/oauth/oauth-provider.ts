export const OAUTH_PROVIDERS = ['google', 'github'] as const;

export type OauthProviderName = (typeof OAUTH_PROVIDERS)[number];

export function isOauthProviderName(value: string): value is OauthProviderName {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
