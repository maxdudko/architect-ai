import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user account' })
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Post('signin')
  @ApiOperation({ summary: 'Sign in with email and password' })
  signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Log out and invalidate user refresh session' })
  logout(@CurrentUser() user: RequestUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.sub, dto.refreshToken);
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
