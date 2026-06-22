import { describe, expect, it } from 'vitest';
import { buildApiHealthUrl } from './health';

describe('buildApiHealthUrl', () => {
  it('appends /health to base URL', () => {
    expect(buildApiHealthUrl('http://localhost:5000')).toBe('http://localhost:5000/health');
  });

  it('handles trailing slash in base URL', () => {
    expect(buildApiHealthUrl('http://localhost:5000/')).toBe('http://localhost:5000/health');
  });
});
