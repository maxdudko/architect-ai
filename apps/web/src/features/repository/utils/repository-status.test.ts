import { describe, expect, it } from 'vitest';
import {
  getRepositoryActionVisibility,
  getRepositoryStatusLabel,
  isRepositoryIndexingActive,
} from './repository-status';

describe('repository status helpers', () => {
  it('marks CHUNKING as active for polling', () => {
    expect(isRepositoryIndexingActive('CHUNKING')).toBe(true);
    expect(isRepositoryIndexingActive('READY')).toBe(false);
  });

  it('returns human labels for statuses', () => {
    expect(getRepositoryStatusLabel('CHUNKING')).toBe('Chunking');
    expect(getRepositoryStatusLabel('FAILED')).toBe('Failed');
  });

  it('returns action visibility by status and role capability', () => {
    expect(getRepositoryActionVisibility('FAILED', true)).toEqual({
      showRetry: true,
      showReindex: false,
      allowDisconnect: true,
    });
    expect(getRepositoryActionVisibility('READY', true)).toEqual({
      showRetry: false,
      showReindex: true,
      allowDisconnect: true,
    });
    expect(getRepositoryActionVisibility('PARSING', true)).toEqual({
      showRetry: false,
      showReindex: false,
      allowDisconnect: false,
    });
    expect(getRepositoryActionVisibility('PENDING', true)).toEqual({
      showRetry: true,
      showReindex: false,
      allowDisconnect: true,
    });
    expect(getRepositoryActionVisibility('READY', false)).toEqual({
      showRetry: false,
      showReindex: false,
      allowDisconnect: false,
    });
  });
});
