import { assertRequiredProductionEnv } from './assert-production-env';

describe('assertRequiredProductionEnv', () => {
  const completeEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@postgres:5432/db',
    TOKEN_ENCRYPTION_KEY: 'encryption-secret',
    GITHUB_OAUTH_STATE_SECRET: 'oauth-state-secret',
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_OAUTH_REDIRECT_URI:
      'https://api.example.com/auth/oauth/google/callback',
    AUTH_GITHUB_OAUTH_REDIRECT_URI:
      'https://api.example.com/auth/oauth/github/callback',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ADMIN_ACCESS_SECRET: 'admin-access-secret',
    JWT_ADMIN_REFRESH_SECRET: 'admin-refresh-secret',
    STRIPE_SECRET_KEY: 'sk_test_secret',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  };

  it('skips validation in development', () => {
    expect(() =>
      assertRequiredProductionEnv({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('skips validation in test', () => {
    expect(() =>
      assertRequiredProductionEnv({ NODE_ENV: 'test' }),
    ).not.toThrow();
  });

  it('passes when all production secrets are present', () => {
    expect(() => assertRequiredProductionEnv(completeEnv)).not.toThrow();
  });

  it('fails when JWT secrets are missing', () => {
    expect(() =>
      assertRequiredProductionEnv({
        ...completeEnv,
        JWT_ACCESS_SECRET: '',
        JWT_REFRESH_SECRET: undefined,
      }),
    ).toThrow(
      'Missing required environment variables: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET',
    );
  });
});
