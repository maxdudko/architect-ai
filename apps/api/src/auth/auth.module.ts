import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
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
  controllers: [AuthController],
  providers: [AuthService, SessionStoreService, JwtStrategy, WorkspaceGuard],
  exports: [AuthService],
})
export class AuthModule {}
