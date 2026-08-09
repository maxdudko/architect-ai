import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AdminsRepository } from './admins.repository';
import { AdminsService } from './admins.service';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminCookieService } from './auth/admin-cookie.service';
import { AdminSessionStoreService } from './auth/admin-session-store.service';
import { AdminJwtStrategy } from './auth/strategies/admin-jwt.strategy';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminUsersController } from './users/admin-users.controller';

@Module({
  imports: [ConfigModule, PassportModule, JwtModule, UsersModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminsRepository,
    AdminsService,
    AdminAuthService,
    AdminCookieService,
    AdminSessionStoreService,
    AdminJwtStrategy,
    AdminJwtAuthGuard,
    AdminAnalyticsService,
  ],
  exports: [AdminsService, AdminAuthService, AdminJwtAuthGuard],
})
export class AdminModule {}
