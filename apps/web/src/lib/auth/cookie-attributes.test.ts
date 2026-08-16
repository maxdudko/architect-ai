import { describe, expect, it } from 'vitest';
import { clientCookieAttributes } from './cookie-attributes';

describe('clientCookieAttributes', () => {
  it('omits Secure outside production', () => {
    expect(clientCookieAttributes(86400, 'development')).toBe(
      'path=/; max-age=86400; samesite=lax',
    );
  });

  it('adds Secure in production', () => {
    expect(clientCookieAttributes(3600, 'production')).toBe(
      'path=/; max-age=3600; samesite=lax; Secure',
    );
  });
});
