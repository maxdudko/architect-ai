import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { ConversationsModule } from '../conversations/conversations.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsageModule } from '../usage/usage.module';
import { WorkspaceAiModule } from '../workspace-ai/workspace-ai.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    MembershipsModule,
    ConversationsModule,
    RepositoriesModule,
    RetrievalModule,
    UsageModule,
    WorkspaceAiModule,
    AnalyticsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, WorkspaceParamGuard, RolesGuard],
  exports: [ChatService],
})
export class ChatModule {}
