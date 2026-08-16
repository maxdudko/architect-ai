import { forwardRef, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { GithubIntegrationModule } from '../integrations/github/github-integration.module';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { CodeIntelligenceModule } from '../modules/code-intelligence/code-intelligence.module';
import { OnboardingModule } from '../modules/onboarding/onboarding.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { UsageModule } from '../usage/usage.module';
import { IndexingStorageService } from './indexing/indexing-storage.service';
import { RepositoryChunkService } from './indexing/repository-chunk.service';
import { RepositoryCloneService } from './indexing/repository-clone.service';
import { RepositoryEmbeddingService } from './indexing/repository-embedding.service';
import { RepositoryIndexingWorkerService } from './indexing/repository-indexing.worker.service';
import { RepositoryParseService } from './indexing/repository-parse.service';
import { RepositoriesController } from './repositories.controller';
import { RepositoryAccessValidationService } from './repository-access-validation.service';
import { RepositoryIndexingQueueService } from './repository-indexing.queue.service';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [
    MembershipsModule,
    forwardRef(() => GithubIntegrationModule),
    CodeIntelligenceModule,
    RetrievalModule,
    OnboardingModule,
    UsageModule,
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesRepository,
    RepositoriesService,
    RepositoryAccessValidationService,
    RepositoryIndexingQueueService,
    RepositoryIndexingWorkerService,
    RepositoryCloneService,
    RepositoryParseService,
    RepositoryChunkService,
    RepositoryEmbeddingService,
    IndexingStorageService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [
    RepositoriesService,
    RepositoriesRepository,
    RepositoryAccessValidationService,
    RepositoryIndexingQueueService,
  ],
})
export class RepositoriesModule {}
