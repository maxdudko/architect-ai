import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_OPTIONS_KEY,
  type RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';
import type { RequestUser } from '../interfaces/request-user.interface';

interface RateWindowState {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, RateWindowState>();
  private readonly defaultLimit: number;
  private readonly defaultWindowMs: number;
  private readonly enabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.defaultLimit = Number(
      this.configService.get<string>('RATE_LIMIT_DEFAULT_LIMIT') ?? 120,
    );
    this.defaultWindowMs = Number(
      this.configService.get<string>('RATE_LIMIT_DEFAULT_WINDOW_MS') ?? 60_000,
    );
    this.enabled =
      (this.configService.get<string>('RATE_LIMIT_ENABLED') ?? 'true') ===
      'true';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      method?: string;
      route?: { path?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    }>();

    const options = this.resolveOptions(context);
    const key = this.buildKey(request, context);
    const now = Date.now();
    const state = this.windows.get(key);

    if (!state || state.expiresAt <= now) {
      this.windows.set(key, {
        count: 1,
        expiresAt: now + options.windowMs,
      });
      return true;
    }

    if (state.count >= options.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.expiresAt - now) / 1000),
      );
      throw new HttpException(
        {
          message: 'Too many requests. Please retry later.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    state.count += 1;
    this.windows.set(key, state);
    return true;
  }

  private resolveOptions(context: ExecutionContext): RateLimitOptions {
    return (
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_OPTIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? {
        limit: this.defaultLimit,
        windowMs: this.defaultWindowMs,
      }
    );
  }

  private buildKey(
    request: {
      user?: RequestUser;
      method?: string;
      route?: { path?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    },
    context: ExecutionContext,
  ): string {
    const handlerName = context.getHandler().name;
    const method = request.method ?? 'UNKNOWN';
    const routePath = request.route?.path ?? handlerName;
    const ipHeader = request.headers?.['x-forwarded-for'];
    const forwardedFor = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader;
    const ip =
      forwardedFor?.split(',')[0]?.trim() ??
      request.ip ??
      request.socket?.remoteAddress ??
      'unknown';
    const actor = request.user?.sub ? `user:${request.user.sub}` : `ip:${ip}`;
    return `${actor}:${method}:${routePath}`;
  }
}
