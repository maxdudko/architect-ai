import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from '../billing/billing.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { LlmModule } from '../modules/llm/llm.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceAiController } from './workspace-ai.controller';
import { WorkspaceAiService } from './workspace-ai.service';
import { WorkspaceLlmResolver } from './workspace-llm.resolver';

@Module({
  imports: [
    ConfigModule,
    CryptoModule,
    LlmModule,
    MembershipsModule,
    WorkspacesModule,
    BillingModule,
  ],
  controllers: [WorkspaceAiController],
  providers: [
    WorkspaceAiService,
    WorkspaceLlmResolver,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [WorkspaceAiService, WorkspaceLlmResolver],
})
export class WorkspaceAiModule {}
