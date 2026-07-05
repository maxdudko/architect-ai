import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { GithubTokenCipherService } from './github-token-cipher.service';

describe('GithubTokenCipherService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'TOKEN_ENCRYPTION_KEY') {
        return 'unit-test-encryption-secret';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  it('encrypts and decrypts token payloads', () => {
    const service = new GithubTokenCipherService(configService);
    const token = 'gho_super_secret';

    const encrypted = service.encrypt(token);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(token);
    expect(decrypted).toBe(token);
  });

  it('throws when decrypting malformed payload', () => {
    const service = new GithubTokenCipherService(configService);
    expect(() => service.decrypt('invalid')).toThrow(
      InternalServerErrorException,
    );
  });
});
