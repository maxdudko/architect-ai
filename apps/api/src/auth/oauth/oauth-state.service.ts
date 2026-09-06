import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { sanitizeOauthNextPath } from './oauth-names';
import type { OauthProviderName } from './oauth-provider';

interface OauthStatePayload {
  provider: OauthProviderName;
  exp: number;
  nonce: string;
  next?: string;
}

@Injectable()
export class OauthStateService {
  private readonly secret: string;
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('AUTH_OAUTH_STATE_SECRET') ??
      this.configService.get<string>('GITHUB_OAUTH_STATE_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'architect-ai-dev-oauth-state-secret';
  }

  createState(params: { provider: OauthProviderName; next?: string }): string {
    const payload: OauthStatePayload = {
      provider: params.provider,
      exp: Date.now() + this.ttlMs,
      nonce: randomBytes(12).toString('base64url'),
      next: sanitizeOauthNextPath(params.next),
    };
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.sign(payloadEncoded);
    return `${payloadEncoded}.${signature}`;
  }

  verifyState(
    state: string,
    expectedProvider: OauthProviderName,
  ): { provider: OauthProviderName; next?: string } {
    const [payloadEncoded, signature] = state.split('.');
    if (!payloadEncoded || !signature) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const expectedSignature = this.sign(payloadEncoded);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as OauthStatePayload;
    if (
      payload.provider !== expectedProvider ||
      !payload.provider ||
      payload.exp < Date.now()
    ) {
      throw new UnauthorizedException('OAuth state has expired');
    }

    return {
      provider: payload.provider,
      next: sanitizeOauthNextPath(payload.next),
    };
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
