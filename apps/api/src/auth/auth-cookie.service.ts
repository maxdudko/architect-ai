import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export const REFRESH_TOKEN_COOKIE = 'architect_refresh_token';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.getCookieOptions(this.getRefreshTtlMs()),
    );
  }

  clearRefreshTokenCookie(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.getCookieOptions());
  }

  resolveRefreshToken(request: Request, bodyRefreshToken?: string): string {
    const cookieRefreshToken = this.getRefreshTokenFromRequest(request);
    const refreshToken = cookieRefreshToken ?? bodyRefreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return refreshToken;
  }

  getRefreshTokenFromRequest(request: Request): string | undefined {
    const cookies = this.parseCookieHeader(request.headers.cookie);
    return cookies[REFRESH_TOKEN_COOKIE];
  }

  private parseCookieHeader(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) {
      return {};
    }

    return Object.fromEntries(
      cookieHeader.split(';').flatMap((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
          return [];
        }

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (!key) {
          return [];
        }

        try {
          return [[key, decodeURIComponent(value)]];
        } catch {
          return [[key, value]];
        }
      }),
    );
  }

  private getCookieOptions(maxAge?: number) {
    const domain = this.configService.get<string>('COOKIE_DOMAIN');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      ...(domain ? { domain } : {}),
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }

  private getRefreshTtlMs(): number {
    const ttl = this.configService.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const match = /^(\d+)([dhms])$/.exec(ttl);
    if (!match) {
      return 30 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000,
    };

    return amount * (multipliers[unit] ?? multipliers.d);
  }
}
