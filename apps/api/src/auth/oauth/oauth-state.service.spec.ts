import { UnauthorizedException } from '@nestjs/common';
import { OauthStateService } from './oauth-state.service';

describe('OauthStateService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'AUTH_OAUTH_STATE_SECRET') {
        return 'test-oauth-state-secret';
      }
      return undefined;
    }),
  };
  const service = new OauthStateService(configService as never);

  it('round-trips a signed state payload', () => {
    const state = service.createState({
      provider: 'google',
      next: '/dashboard',
    });

    expect(service.verifyState(state, 'google')).toEqual({
      provider: 'google',
      next: '/dashboard',
    });
  });

  it('rejects a state created for a different provider', () => {
    const state = service.createState({ provider: 'google' });

    expect(() => service.verifyState(state, 'github')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a tampered state', () => {
    const state = service.createState({ provider: 'github' });

    expect(() => service.verifyState(`${state}x`, 'github')).toThrow(
      UnauthorizedException,
    );
  });
});
