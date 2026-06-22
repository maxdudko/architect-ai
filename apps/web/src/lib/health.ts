export function buildApiHealthUrl(apiBaseUrl: string): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalized}/health`;
}
