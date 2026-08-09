import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminCookieService } from './admin-cookie.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminLogoutDto } from './dto/admin-logout.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminSignInDto } from './dto/admin-sign-in.dto';
import {
  toPublicAdminAuthResponse,
  toPublicAdminTokenPair,
} from './interfaces/admin-auth-response.interface';
import type { AdminJwtPayload } from './interfaces/admin-jwt-payload.interface';

@ApiTags('Admin Authentication')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminCookieService: AdminCookieService,
  ) {}

  @Post('signin')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @ApiOperation({ summary: 'Sign in as a platform admin' })
  async signIn(
    @Body() dto: AdminSignInDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminAuthService.signIn(dto);
    this.adminCookieService.setRefreshTokenCookie(
      response,
      result.refreshToken,
    );
    return toPublicAdminAuthResponse(result);
  }

  @Post('refresh')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Rotate admin refresh token and issue a new access token',
  })
  async refresh(
    @Body() dto: AdminRefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.adminCookieService.resolveRefreshToken(
      request,
      dto.refreshToken,
    );
    const tokens = await this.adminAuthService.refresh({
      ...dto,
      refreshToken,
    });
    this.adminCookieService.setRefreshTokenCookie(
      response,
      tokens.refreshToken,
    );
    return toPublicAdminTokenPair(tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @ApiOperation({ summary: 'Log out and invalidate admin refresh session' })
  async logout(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: AdminLogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      this.adminCookieService.getRefreshTokenFromRequest(request) ??
      dto.refreshToken;
    await this.adminAuthService.logout(admin.sub, refreshToken);
    this.adminCookieService.clearRefreshTokenCookie(response);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @ApiOperation({ summary: 'Get authenticated admin context' })
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuthService.me(admin.sub);
  }
}
