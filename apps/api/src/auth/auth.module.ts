import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GithubIdentityOauthClient } from './oauth/github-identity-oauth.client';
import { GoogleOauthClient } from './oauth/google-oauth.client';
import { IdentityAccountsRepository } from './oauth/identity-accounts.repository';
import { OauthController } from './oauth/oauth.controller';
import { OauthService } from './oauth/oauth.service';
import { OauthStateService } from './oauth/oauth-state.service';
import { SessionStoreService } from './session-store.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule,
    UsersModule,
    forwardRef(() => WorkspacesModule),
    MembershipsModule,
  ],
  controllers: [AuthController, OauthController],
  providers: [
    AuthService,
    AuthCookieService,
    SessionStoreService,
    JwtStrategy,
    WorkspaceGuard,
    OauthStateService,
    GoogleOauthClient,
    GithubIdentityOauthClient,
    IdentityAccountsRepository,
    OauthService,
  ],
  exports: [AuthService, AuthCookieService],
})
export class AuthModule {}
