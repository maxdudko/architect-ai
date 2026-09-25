import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalyticsModule } from '../../analytics/analytics.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../common/guards/workspace-param.guard';
import { ConversationsModule } from '../../conversations/conversations.module';
import { MembershipsModule } from '../../memberships/memberships.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsageModule } from '../../usage/usage.module';
import { WorkspaceAiModule } from '../../workspace-ai/workspace-ai.module';
import { InMemoryDependencyMapCache } from './dependency-mapping/cache/in-memory-dependency-map.cache';
import { RedisDependencyMapCache } from './dependency-mapping/cache/redis-dependency-map.cache';
import { DEPENDENCY_MAP_CACHE } from './dependency-mapping/cache/dependency-map-cache.interface';
import { PrismaArchitectureDataSource } from './dependency-mapping/data/prisma-architecture-data-source';
import { DependencyMapController } from './dependency-mapping/dependency-map.controller';
import { DependencyMapService } from './dependency-mapping/dependency-map.service';
import { DependencyGraphProvider } from './dependency-mapping/dependency-graph.provider';
import { DependencyGraphBuilder } from './dependency-mapping/derivation/dependency-graph.builder';
import { ModuleGrouperService } from './dependency-mapping/derivation/module-grouper.service';
import { TargetResolverService } from './dependency-mapping/derivation/target-resolver.service';
import { ArchitectureSearchController } from './architecture-search/architecture-search.controller';
import { ArchitectureSearchService } from './architecture-search/architecture-search.service';
import { SystemOverviewController } from './system-overview/system-overview.controller';
import { SystemOverviewOrchestrator } from './system-overview/system-overview.orchestrator';
import { SystemOverviewPromptBuilder } from './system-overview/system-overview-prompt.builder';
import { SystemOverviewService } from './system-overview/system-overview.service';
import { SystemOverviewQueueService } from './system-overview/queue/system-overview-queue.service';
import { SystemOverviewWorkerService } from './system-overview/queue/system-overview-worker.service';

/**
 * Phase 2 Architecture Explorer.
 *
 * Dependency Mapping owns the module grouping and the dependency edges, so
 * `DependencyGraphProvider` and `DependencyMapService` are exported for
 * Architecture Search and System Overview to consume rather than re-deriving.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MembershipsModule,
    ConversationsModule,
    UsageModule,
    WorkspaceAiModule,
    RetrievalModule,
    AnalyticsModule,
  ],
  controllers: [
    DependencyMapController,
    ArchitectureSearchController,
    SystemOverviewController,
  ],
  providers: [
    PrismaArchitectureDataSource,
    ModuleGrouperService,
    TargetResolverService,
    DependencyGraphBuilder,
    {
      provide: DEPENDENCY_MAP_CACHE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const driver =
          configService.get<string>('ARCHITECTURE_CACHE_DRIVER') ?? 'redis';
        return driver === 'memory'
          ? new InMemoryDependencyMapCache()
          : new RedisDependencyMapCache(configService);
      },
    },
    DependencyGraphProvider,
    DependencyMapService,
    ArchitectureSearchService,
    SystemOverviewPromptBuilder,
    SystemOverviewOrchestrator,
    SystemOverviewQueueService,
    SystemOverviewWorkerService,
    SystemOverviewService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [DependencyGraphProvider, DependencyMapService],
})
export class ArchitectureModule {}
