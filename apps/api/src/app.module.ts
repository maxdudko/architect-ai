import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { GithubIntegrationModule } from './integrations/github/github-integration.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MailModule } from './mail/mail.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    MembershipsModule,
    WorkspacesModule,
    InvitationsModule,
    OnboardingModule,
    RepositoriesModule,
    ConversationsModule,
    ChatModule,
    GithubIntegrationModule,
    MailModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
