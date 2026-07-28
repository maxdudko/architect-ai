import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GithubBranchResponse,
  GithubRepositoryResponse,
  GithubTokenResponse,
  GithubViewerResponse,
} from './interfaces/github-http.interface';

export class GithubUnauthorizedError extends Error {
  constructor() {
    super('GitHub access token is unauthorized');
  }
}

export class GithubRefreshTokenInvalidError extends Error {
  constructor() {
    super('GitHub refresh token is invalid');
  }
}

@Injectable()
export class GithubHttpService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GITHUB_CLIENT_ID') ?? '';
    this.clientSecret =
      this.configService.get<string>('GITHUB_CLIENT_SECRET') ?? '';
    this.redirectUri =
      this.configService.get<string>('GITHUB_OAUTH_REDIRECT_URI') ??
      'http://localhost:5000/integrations/github/callback';
  }

  buildConnectUrl(state: string): string {
    if (!this.clientId) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured: set GITHUB_CLIENT_ID',
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo read:user',
      state,
      allow_signup: 'false',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET',
      );
    }

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

    const body = (await response.json()) as GithubTokenResponse & {
      error?: string;
      error_description?: string;
    };

    if (!response.ok || body.error || !body.access_token) {
      throw new BadGatewayException(
        body.error_description ??
          body.error ??
          'Failed to exchange GitHub OAuth code',
      );
    }

    return body;
  }

  async exchangeRefreshToken(
    refreshToken: string,
  ): Promise<GithubTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET',
      );
    }

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
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
    );

    const body = (await response.json()) as GithubTokenResponse & {
      error?: string;
      error_description?: string;
    };

    if (!response.ok || body.error || !body.access_token) {
      if (body.error === 'invalid_grant') {
        throw new GithubRefreshTokenInvalidError();
      }
      throw new BadGatewayException(
        body.error_description ??
          body.error ??
          'Failed to refresh GitHub OAuth token',
      );
    }

    return body;
  }

  async getViewer(accessToken: string): Promise<GithubViewerResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const body = (await response.json()) as GithubViewerResponse;
    if (response.status === 401) {
      throw new GithubUnauthorizedError();
    }
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch GitHub user profile');
    }
    return body;
  }

  async listRepositories(
    accessToken: string,
    page: number,
    perPage: number,
  ): Promise<{
    repositories: GithubRepositoryResponse[];
    hasNextPage: boolean;
  }> {
    const response = await fetch(
      `https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&page=${page}&per_page=${perPage}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 401) {
      throw new GithubUnauthorizedError();
    }
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch GitHub repositories');
    }

    const body = (await response.json()) as GithubRepositoryResponse[];
    if (!Array.isArray(body)) {
      throw new BadGatewayException('Unexpected GitHub repositories response');
    }

    const linkHeader = response.headers.get('link');
    const hasNextPage = Boolean(linkHeader?.includes('rel="next"'));

    return {
      repositories: body,
      hasNextPage,
    };
  }

  async getRepositoryById(
    accessToken: string,
    repositoryId: string,
  ): Promise<GithubRepositoryResponse> {
    const response = await fetch(
      `https://api.github.com/repositories/${repositoryId}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 401) {
      throw new GithubUnauthorizedError();
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Failed to fetch GitHub repository details',
      );
    }

    const body = (await response.json()) as GithubRepositoryResponse;
    if (!body || typeof body.id !== 'number' || !body.full_name) {
      throw new BadGatewayException('Unexpected GitHub repository response');
    }

    return body;
  }

  async getRepositoryByFullName(
    accessToken: string,
    owner: string,
    name: string,
  ): Promise<GithubRepositoryResponse> {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 401) {
      throw new GithubUnauthorizedError();
    }
    if (response.status === 404) {
      throw new NotFoundException(
        'GitHub repository not found or is not accessible',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Failed to fetch GitHub repository details',
      );
    }

    const body = (await response.json()) as GithubRepositoryResponse;
    if (!body || typeof body.id !== 'number' || !body.full_name) {
      throw new BadGatewayException('Unexpected GitHub repository response');
    }

    return body;
  }

  async listBranches(
    accessToken: string,
    owner: string,
    name: string,
    page: number,
    perPage: number,
  ): Promise<{
    branches: GithubBranchResponse[];
    hasNextPage: boolean;
  }> {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 401) {
      throw new GithubUnauthorizedError();
    }
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch GitHub branches');
    }

    const body = (await response.json()) as GithubBranchResponse[];
    if (!Array.isArray(body)) {
      throw new BadGatewayException('Unexpected GitHub branches response');
    }

    const linkHeader = response.headers.get('link');
    const hasNextPage = Boolean(linkHeader?.includes('rel="next"'));

    return {
      branches: body,
      hasNextPage,
    };
  }
}
