const REQUIRED_PRODUCTION_ENV_VARS = [
  'DATABASE_URL',
  'TOKEN_ENCRYPTION_KEY',
  'GITHUB_OAUTH_STATE_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ADMIN_ACCESS_SECRET',
  'JWT_ADMIN_REFRESH_SECRET',
] as const;

export function assertRequiredProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const nodeEnv = env.NODE_ENV?.toLowerCase() ?? 'development';
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return;
  }

  const missingVars = REQUIRED_PRODUCTION_ENV_VARS.filter((name) => {
    const value = env[name];
    return !value || value.trim().length === 0;
  });

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }
}
