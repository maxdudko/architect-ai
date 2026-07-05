import { forwardRef, Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { GithubIntegrationModule } from '../integrations/github/github-integration.module';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { RepositoriesController } from './repositories.controller';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [MembershipsModule, forwardRef(() => GithubIntegrationModule)],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesRepository,
    RepositoriesService,
    RepositoryIndexingQueueService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [
    RepositoriesService,
    RepositoriesRepository,
    RepositoryIndexingQueueService,
  ],
})
export class RepositoriesModule {}
