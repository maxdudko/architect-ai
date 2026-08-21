import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GithubCallbackQueryDto } from './github-callback-query.dto';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
} as const;

describe('GithubCallbackQueryDto', () => {
  it('accepts GitHub RFC 9207 iss on the OAuth callback', async () => {
    const dto = plainToInstance(GithubCallbackQueryDto, {
      code: 'oauth-code',
      state: 'signed-state',
      iss: 'https://github.com/login/oauth',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors).toHaveLength(0);
  });

  it('accepts OAuth error_uri on the callback', async () => {
    const dto = plainToInstance(GithubCallbackQueryDto, {
      error: 'access_denied',
      error_description: 'The user denied the request',
      error_uri: 'https://docs.github.com/apps/oauth-apps',
      state: 'signed-state',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors).toHaveLength(0);
  });

  it('rejects unknown callback query properties', async () => {
    const dto = plainToInstance(GithubCallbackQueryDto, {
      code: 'oauth-code',
      unexpected: 'nope',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });
});
