import { describe, expect, it } from 'vitest';
import { formatServiceHealth } from './index.js';

describe('formatServiceHealth', () => {
  it('formats service health details', () => {
    expect(formatServiceHealth({ service: 'api', status: 'ok' })).toBe('api:ok');
  });
});
