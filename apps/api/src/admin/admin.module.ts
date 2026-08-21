import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BillingModule } from '../billing/billing.module';
import { UsageModule } from '../usage/usage.module';
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
import { AdminLogsController } from './logs/admin-logs.controller';
import { AdminPlansController } from './plans/admin-plans.controller';
import { AdminPlansService } from './plans/admin-plans.service';
import { AdminUsageController } from './usage/admin-usage.controller';
import { AdminUsageService } from './usage/admin-usage.service';
import { AdminUsersController } from './users/admin-users.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule,
    UsersModule,
    UsageModule,
    BillingModule,
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminAnalyticsController,
    AdminLogsController,
    AdminPlansController,
    AdminUsageController,
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
    AdminPlansService,
    AdminUsageService,
  ],
  exports: [AdminsService, AdminAuthService, AdminJwtAuthGuard],
})
export class AdminModule {}
