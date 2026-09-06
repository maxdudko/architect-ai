import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OauthProfile } from './interfaces/oauth-profile.interface';
import { splitDisplayName } from './oauth-names';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  id?: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

@Injectable()
export class GoogleOauthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret =
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri =
      this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URI') ??
      'http://localhost:5000/auth/oauth/google/callback';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  buildAuthorizeUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<OauthProfile> {
    this.assertConfigured();
    const accessToken = await this.exchangeCodeForToken(code);
    const userInfo = await this.fetchUserInfo(accessToken);

    const providerUserId = userInfo.id?.trim();
    if (!providerUserId) {
      throw new BadGatewayException('Google profile is missing a user id');
    }

    const names = splitDisplayName(
      userInfo.given_name && userInfo.family_name
        ? `${userInfo.given_name} ${userInfo.family_name}`
        : userInfo.name,
      userInfo.email?.split('@')[0] ?? 'User',
    );

    return {
      provider: 'google',
      providerUserId,
      email: userInfo.email?.toLowerCase() ?? null,
      emailVerified: Boolean(userInfo.verified_email && userInfo.email),
      firstName: userInfo.given_name?.trim() || names.firstName,
      lastName: userInfo.family_name?.trim() || names.lastName,
      avatarUrl: userInfo.picture ?? null,
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      );
    }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const body = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !body.access_token) {
      throw new BadGatewayException(
        body.error_description ??
          body.error ??
          'Failed to exchange Google OAuth code',
      );
    }
    return body.access_token;
  }

  private async fetchUserInfo(
    accessToken: string,
  ): Promise<GoogleUserInfoResponse> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const body = (await response.json()) as GoogleUserInfoResponse;
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch Google user profile');
    }
    return body;
  }
}
