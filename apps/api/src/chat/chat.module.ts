import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { ConversationsModule } from '../conversations/conversations.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { LlmModule } from '../modules/llm/llm.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    MembershipsModule,
    ConversationsModule,
    RepositoriesModule,
    RetrievalModule,
    LlmModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, WorkspaceParamGuard, RolesGuard],
  exports: [ChatService],
})
export class ChatModule {}
