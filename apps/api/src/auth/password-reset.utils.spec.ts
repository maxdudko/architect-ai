import { hashPasswordResetToken } from './password-reset.utils';

describe('password-reset.utils', () => {
  it('hashes tokens with sha256 hex', () => {
    expect(hashPasswordResetToken('reset-token')).toHaveLength(64);
    expect(hashPasswordResetToken('reset-token')).toBe(
      hashPasswordResetToken('reset-token'),
    );
    expect(hashPasswordResetToken('reset-token')).not.toBe(
      hashPasswordResetToken('other-token'),
    );
  });
});
