import { sanitizeOauthNextPath, splitDisplayName } from './oauth-names';

describe('splitDisplayName', () => {
  it('splits a full name', () => {
    expect(splitDisplayName('Ada Lovelace', 'ada')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('uses a single token as the first name', () => {
    expect(splitDisplayName('octocat', 'octocat')).toEqual({
      firstName: 'octocat',
      lastName: '',
    });
  });

  it('falls back when the display name is empty', () => {
    expect(splitDisplayName('  ', 'login')).toEqual({
      firstName: 'login',
      lastName: '',
    });
  });
});

describe('sanitizeOauthNextPath', () => {
  it('allows relative paths', () => {
    expect(sanitizeOauthNextPath('/dashboard')).toBe('/dashboard');
  });

  it('rejects open redirects', () => {
    expect(sanitizeOauthNextPath('https://evil.example')).toBeUndefined();
    expect(sanitizeOauthNextPath('//evil.example')).toBeUndefined();
    expect(sanitizeOauthNextPath('\\evil')).toBeUndefined();
  });
});
