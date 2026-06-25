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
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import {
  toPublicAuthResponse,
  toPublicTokenPair,
} from './interfaces/public-auth-response.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user account' })
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signUp(dto);
    this.authCookieService.setRefreshTokenCookie(response, result.refreshToken);
    return toPublicAuthResponse(result);
  }

  @Post('signin')
  @ApiOperation({ summary: 'Sign in with email and password' })
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signIn(dto);
    this.authCookieService.setRefreshTokenCookie(response, result.refreshToken);
    return toPublicAuthResponse(result);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.authCookieService.resolveRefreshToken(
      request,
      dto.refreshToken,
    );
    const tokens = await this.authService.refresh({
      ...dto,
      refreshToken,
    });
    this.authCookieService.setRefreshTokenCookie(response, tokens.refreshToken);
    return toPublicTokenPair(tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Log out and invalidate user refresh session' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Body() dto: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      this.authCookieService.getRefreshTokenFromRequest(request) ??
      dto.refreshToken;
    await this.authService.logout(user.sub, refreshToken);
    this.authCookieService.clearRefreshTokenCookie(response);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Get authenticated user context' })
  me(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() workspace: { id: string },
  ) {
    return this.authService.me({
      ...user,
      activeWorkspaceId: workspace.id,
    });
  }
}
