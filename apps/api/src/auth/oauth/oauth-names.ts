export function splitDisplayName(
  displayName: string | null | undefined,
  fallback: string,
): { firstName: string; lastName: string } {
  const trimmed = displayName?.trim() || fallback.trim() || 'User';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'User', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function sanitizeOauthNextPath(next?: string): string | undefined {
  if (!next) {
    return undefined;
  }
  const trimmed = next.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return undefined;
  }
  return trimmed;
}
