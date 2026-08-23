import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OauthProfile } from './interfaces/oauth-profile.interface';
import { splitDisplayName } from './oauth-names';

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
}

interface GithubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

@Injectable()
export class GithubIdentityOauthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId =
      this.configService.get<string>('AUTH_GITHUB_CLIENT_ID') ||
      this.configService.get<string>('GITHUB_CLIENT_ID') ||
      '';
    this.clientSecret =
      this.configService.get<string>('AUTH_GITHUB_CLIENT_SECRET') ||
      this.configService.get<string>('GITHUB_CLIENT_SECRET') ||
      '';
    this.redirectUri =
      this.configService.get<string>('AUTH_GITHUB_OAUTH_REDIRECT_URI') ??
      'http://localhost:5000/auth/oauth/github/callback';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  buildAuthorizeUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<OauthProfile> {
    this.assertConfigured();
    const accessToken = await this.exchangeCodeForToken(code);
    const [viewer, emails] = await Promise.all([
      this.fetchUser(accessToken),
      this.fetchEmails(accessToken),
    ]);

    const providerUserId =
      typeof viewer.id === 'number' ? String(viewer.id) : '';
    if (!providerUserId || !viewer.login) {
      throw new BadGatewayException('GitHub profile is missing a user id');
    }

    const selectedEmail = this.selectEmail(emails);
    const names = splitDisplayName(viewer.name, viewer.login);

    return {
      provider: 'github',
      providerUserId,
      email: selectedEmail?.email.toLowerCase() ?? null,
      emailVerified: Boolean(selectedEmail?.verified),
      firstName: names.firstName,
      lastName: names.lastName,
      avatarUrl: viewer.avatar_url ?? null,
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'GitHub identity OAuth is not configured: set AUTH_GITHUB_CLIENT_ID or GITHUB_CLIENT_ID',
      );
    }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        }),
      },
    );

    const body = (await response.json()) as GithubTokenResponse;
    if (!response.ok || body.error || !body.access_token) {
      throw new BadGatewayException(
        body.error_description ??
          body.error ??
          'Failed to exchange GitHub OAuth code',
      );
    }
    return body.access_token;
  }

  private async fetchUser(accessToken: string): Promise<GithubUserResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const body = (await response.json()) as GithubUserResponse;
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch GitHub user profile');
    }
    return body;
  }

  private async fetchEmails(
    accessToken: string,
  ): Promise<GithubEmailResponse[]> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const body = (await response.json()) as GithubEmailResponse[];
    if (!response.ok || !Array.isArray(body)) {
      throw new BadGatewayException('Failed to fetch GitHub user emails');
    }
    return body;
  }

  private selectEmail(
    emails: GithubEmailResponse[],
  ): GithubEmailResponse | undefined {
    const verified = emails.filter((item) => item.verified && item.email);
    return verified.find((item) => item.primary) ?? verified[0];
  }
}
