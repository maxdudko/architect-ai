import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

function createContext(request: {
  method: string;
  route: { path: string };
  ip?: string;
}) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;
  let guard: RateLimitGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_ENABLED') {
          return 'true';
        }
        if (key === 'RATE_LIMIT_DEFAULT_LIMIT') {
          return '2';
        }
        if (key === 'RATE_LIMIT_DEFAULT_WINDOW_MS') {
          return '60000';
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new RateLimitGuard(reflector, configService);
  });

  it('allows requests until the configured limit is reached', () => {
    const context = createContext({
      method: 'POST',
      route: { path: '/auth/signin' },
      ip: '127.0.0.1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (error) {
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
