export function clientCookieAttributes(
  maxAgeSeconds = 86400,
  nodeEnv = process.env.NODE_ENV,
): string {
  const secure = nodeEnv === 'production' ? '; Secure' : '';
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`;
}
