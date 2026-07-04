import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

interface GithubOAuthStatePayload {
  userId: string;
  workspaceId?: string;
  exp: number;
  nonce: string;
}

@Injectable()
export class GithubOauthStateService {
  private readonly secret: string;
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('GITHUB_OAUTH_STATE_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'architect-ai-dev-oauth-state-secret';
  }

  createState(params: { userId: string; workspaceId?: string }): string {
    const payload: GithubOAuthStatePayload = {
      userId: params.userId,
      workspaceId: params.workspaceId,
      exp: Date.now() + this.ttlMs,
      nonce: randomBytes(12).toString('base64url'),
    };
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.sign(payloadEncoded);
    return `${payloadEncoded}.${signature}`;
  }

  verifyState(state: string): { userId: string; workspaceId?: string } {
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
    const payload = JSON.parse(decoded) as GithubOAuthStatePayload;
    if (!payload.userId || payload.exp < Date.now()) {
      throw new UnauthorizedException('OAuth state has expired');
    }

    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
    };
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}
