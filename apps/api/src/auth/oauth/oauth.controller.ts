import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthCookieService } from '../auth-cookie.service';
import { OauthCallbackQueryDto } from './dto/oauth-callback-query.dto';
import { OauthStartQueryDto } from './dto/oauth-start-query.dto';
import { OauthService } from './oauth.service';
import type { OauthProviderName } from './oauth-provider';

@ApiTags('Authentication')
@Controller('auth/oauth')
export class OauthController {
  constructor(
    private readonly oauthService: OauthService,
    private readonly authCookieService: AuthCookieService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google/start')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Start Google identity OAuth' })
  startGoogle(
    @Query() query: OauthStartQueryDto,
    @Res() response: Response,
  ): void {
    this.redirectToProvider(response, 'google', query.next);
  }

  @Get('github/start')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Start GitHub identity OAuth' })
  startGithub(
    @Query() query: OauthStartQueryDto,
    @Res() response: Response,
  ): void {
    this.redirectToProvider(response, 'github', query.next);
  }

  @Get('google/callback')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Google identity OAuth callback' })
  async googleCallback(
    @Query() query: OauthCallbackQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.handleCallback(response, 'google', query);
  }

  @Get('github/callback')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'GitHub identity OAuth callback' })
  async githubCallback(
    @Query() query: OauthCallbackQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.handleCallback(response, 'github', query);
  }

  private redirectToProvider(
    response: Response,
    provider: OauthProviderName,
    next?: string,
  ): void {
    try {
      const url = this.oauthService.buildAuthorizeUrl(provider, next);
      response.redirect(url);
    } catch (error) {
      response.redirect(
        this.errorRedirect(this.oauthService.mapErrorCode(error)),
      );
    }
  }

  private async handleCallback(
    response: Response,
    provider: OauthProviderName,
    query: OauthCallbackQueryDto,
  ): Promise<void> {
    try {
      const result = await this.oauthService.authenticateFromCallback(
        provider,
        {
          code: query.code,
          state: query.state,
          error: query.error,
        },
      );
      this.authCookieService.setRefreshTokenCookie(
        response,
        result.auth.refreshToken,
      );
      response.redirect(this.completeRedirect(result.next));
    } catch (error) {
      response.redirect(
        this.errorRedirect(this.oauthService.mapErrorCode(error)),
      );
    }
  }

  private completeRedirect(next?: string): string {
    const completeUrl = new URL('/auth/oauth/complete', this.webUrl());
    if (next) {
      completeUrl.searchParams.set('next', next);
    }
    return completeUrl.toString();
  }

  private errorRedirect(code: string): string {
    const signInUrl = new URL('/sign-in', this.webUrl());
    signInUrl.searchParams.set('oauth_error', code);
    return signInUrl.toString();
  }

  private webUrl(): string {
    return this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }
}
