import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [MembershipsModule, RepositoriesModule],
  controllers: [ConversationsController],
  providers: [
    ConversationsRepository,
    ConversationsService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
