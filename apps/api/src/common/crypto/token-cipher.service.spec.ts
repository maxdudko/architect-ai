import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TokenCipherService } from './token-cipher.service';

describe('TokenCipherService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'TOKEN_ENCRYPTION_KEY') {
        return 'unit-test-encryption-secret';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  it('encrypts and decrypts token payloads', () => {
    const service = new TokenCipherService(configService);
    const token = 'sk-super-secret';

    const encrypted = service.encrypt(token);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(token);
    expect(decrypted).toBe(token);
  });

  it('throws when decrypting malformed payload', () => {
    const service = new TokenCipherService(configService);
    expect(() => service.decrypt('invalid')).toThrow(
      InternalServerErrorException,
    );
  });

  it('fails fast when TOKEN_ENCRYPTION_KEY is missing outside test', () => {
    const strictConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') {
          return 'production';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    expect(() => new TokenCipherService(strictConfigService)).toThrow(
      InternalServerErrorException,
    );
  });
});
