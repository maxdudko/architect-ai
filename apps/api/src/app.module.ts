import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChatModule } from './chat/chat.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ContactModule } from './contact/contact.module';
import { ConversationsModule } from './conversations/conversations.module';
import { GithubIntegrationModule } from './integrations/github/github-integration.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MailModule } from './mail/mail.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ArchitectureModule } from './modules/architecture/architecture.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { SystemLogsModule } from './system-logs/system-logs.module';
import { UsageModule } from './usage/usage.module';
import { UsersModule } from './users/users.module';
import { WorkspaceAiModule } from './workspace-ai/workspace-ai.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SystemLogsModule,
    UsersModule,
    MembershipsModule,
    WorkspacesModule,
    InvitationsModule,
    OnboardingModule,
    RepositoriesModule,
    ArchitectureModule,
    ConversationsModule,
    ChatModule,
    GithubIntegrationModule,
    MailModule,
    ContactModule,
    AuthModule,
    UsageModule,
    WorkspaceAiModule,
    BillingModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
